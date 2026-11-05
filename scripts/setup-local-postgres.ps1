$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$environmentFile = Join-Path $repositoryRoot '.env'
$pgBin = 'C:\Program Files\PostgreSQL\16\bin'
$dataDirectory = 'C:\Program Files\PostgreSQL\16\data'
$hbaFile = Join-Path $dataDirectory 'pg_hba.conf'
$hbaBackup = Join-Path $env:TEMP ("damazon-pg_hba-" + [Guid]::NewGuid().ToString('N') + '.conf')
$psql = Join-Path $pgBin 'psql.exe'
$createdb = Join-Path $pgBin 'createdb.exe'
$pgCtl = Join-Path $pgBin 'pg_ctl.exe'
$setupLog = Join-Path $env:TEMP 'damazon-local-postgres-setup.log'

function Write-SetupStatus([string]$message) {
  Add-Content -LiteralPath $setupLog -Value $message
}

Set-Content -LiteralPath $setupLog -Value 'Starting local PostgreSQL setup.'

if (-not (Test-Path $environmentFile)) {
  throw 'Repository .env file was not found.'
}

$databaseUrlLine = Get-Content $environmentFile |
  Where-Object { $_ -match '^\s*DATABASE_URL=' } |
  Select-Object -First 1
if ($null -eq $databaseUrlLine) {
  throw 'DATABASE_URL was not found in the repository .env file.'
}

$databaseUrl = [Uri]($databaseUrlLine -replace '^\s*DATABASE_URL=', '')
if ($databaseUrl.Host -notin @('localhost', '127.0.0.1', '::1')) {
  throw 'Refusing to configure a non-local database endpoint.'
}

$databaseUser = [Uri]::UnescapeDataString($databaseUrl.UserInfo.Split(':')[0])
$databasePassword = [Uri]::UnescapeDataString(($databaseUrl.UserInfo -split ':', 2)[1])
$databaseName = [Uri]::UnescapeDataString($databaseUrl.AbsolutePath.TrimStart('/'))
if ($databaseName.Contains('/')) {
  $databaseName = $databaseName.Split('/')[0]
}
if ([string]::IsNullOrWhiteSpace($databaseUser) -or
    [string]::IsNullOrWhiteSpace($databasePassword) -or
    [string]::IsNullOrWhiteSpace($databaseName)) {
  throw 'DATABASE_URL must include a database name, user, and password.'
}
if ($databaseUser -notmatch '^[A-Za-z_][A-Za-z0-9_]*$' -or
    $databaseName -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
  throw 'The configured database user and name must use simple SQL identifiers.'
}

if (-not (Test-Path $psql) -or -not (Test-Path $hbaFile)) {
  throw 'PostgreSQL 16 binaries or authentication configuration were not found.'
}

function Invoke-LocalPsql([string]$sql, [string]$database) {
  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo.FileName = $psql
  $process.StartInfo.Arguments = "-X -q -t -A -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d `"$database`""
  $process.StartInfo.UseShellExecute = $false
  $process.StartInfo.RedirectStandardInput = $true
  $process.StartInfo.RedirectStandardOutput = $true
  $process.StartInfo.RedirectStandardError = $true
  if (-not $process.Start()) {
    throw 'Could not start the PostgreSQL client.'
  }
  $process.StandardInput.WriteLine($sql)
  $process.StandardInput.Close()
  $stdout = $process.StandardOutput.ReadToEnd()
  $stderr = $process.StandardError.ReadToEnd()
  $process.WaitForExit()
  if ($process.ExitCode -ne 0) {
    throw "PostgreSQL command failed: $stderr"
  }
  return $stdout.Trim()
}

Copy-Item -LiteralPath $hbaFile -Destination $hbaBackup
try {
  $contents = [System.IO.File]::ReadAllText($hbaFile)
  $temporaryRule = "host all all 127.0.0.1/32 trust`r`n"
  [System.IO.File]::WriteAllText(
    $hbaFile,
    $temporaryRule + $contents,
    [System.Text.Encoding]::ASCII
  )
  & $pgCtl reload -D $dataDirectory
  if ($LASTEXITCODE -ne 0) {
    throw 'Could not reload PostgreSQL with temporary loopback authentication.'
  }
  Write-SetupStatus 'Temporary IPv4 loopback authentication enabled.'

  $quotedUser = $databaseUser.Replace("'", "''")
  $quotedPassword = $databasePassword.Replace("'", "''")
  $roleSql = @"
DO `$setup`$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$quotedUser') THEN
    EXECUTE format('ALTER ROLE %I WITH LOGIN PASSWORD %L', '$quotedUser', '$quotedPassword');
  ELSE
    EXECUTE format('CREATE ROLE %I WITH LOGIN PASSWORD %L', '$quotedUser', '$quotedPassword');
  END IF;
END
`$setup`$;
"@
  Invoke-LocalPsql $roleSql 'postgres' | Out-Null
  Write-SetupStatus 'Application database role is ready.'

  $quotedDbName = $databaseName.Replace("'", "''")
  $databaseExists = Invoke-LocalPsql `
    "SELECT 1 FROM pg_database WHERE datname = '$quotedDbName';" `
    'postgres'
  if ([string]::IsNullOrWhiteSpace($databaseExists)) {
    & (Join-Path $pgBin 'createdb.exe') -h 127.0.0.1 -U postgres -O $databaseUser $databaseName
    if ($LASTEXITCODE -ne 0) {
      throw 'Could not create the configured application database.'
    }
    Write-SetupStatus 'Application database was created.'
  } else {
    Write-SetupStatus 'Application database already exists.'
  }
} catch {
  Write-SetupStatus 'Setup failed before completion; review the elevated PowerShell error output.'
  throw
}
finally {
  Copy-Item -LiteralPath $hbaBackup -Destination $hbaFile -Force
  & $pgCtl reload -D $dataDirectory
  $reloadExitCode = $LASTEXITCODE
  Remove-Item -LiteralPath $hbaBackup -Force
  if ($reloadExitCode -ne 0) {
    Write-SetupStatus 'ERROR: PostgreSQL did not reload restored authentication settings.'
    throw 'Restored the authentication file, but PostgreSQL did not reload it successfully.'
  }
  Write-SetupStatus 'Original PostgreSQL authentication settings restored.'
}

Write-SetupStatus 'Local PostgreSQL setup completed.'
