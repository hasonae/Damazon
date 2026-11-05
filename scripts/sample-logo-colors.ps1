param([string]$Path = 'C:\Users\TOSHIBA\Desktop\Damazon\Damazon logo.png')
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap($Path)
$counts = @{}
$sumR = 0; $sumG = 0; $sumB = 0; $n = 0
for ($y = 0; $y -lt $bmp.Height; $y += 3) {
  for ($x = 0; $x -lt $bmp.Width; $x += 3) {
    $p = $bmp.GetPixel($x, $y)
    if ($p.A -lt 128) { continue }
    if ($p.R -gt 246 -and $p.G -gt 246 -and $p.B -gt 246) { continue }
    $r = [int][Math]::Min(255, [Math]::Floor($p.R / 24.0) * 24)
    $g = [int][Math]::Min(255, [Math]::Floor($p.G / 24.0) * 24)
    $b = [int][Math]::Min(255, [Math]::Floor($p.B / 24.0) * 24)
    $hex = '{0:X2}{1:X2}{2:X2}' -f $r, $g, $b
    if ($counts.ContainsKey($hex)) { $counts[$hex]++ } else { $counts[$hex] = 1 }
    $sumR += $p.R; $sumG += $p.G; $sumB += $p.B; $n++
  }
}
Write-Output ('SIZE: {0}x{1}  opaque-samples={2}' -f $bmp.Width, $bmp.Height, $n)
Write-Output ('AVERAGE: #{0:X2}{1:X2}{2:X2}' -f [int]($sumR / $n), [int]($sumG / $n), [int]($sumB / $n))
$counts.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 24 | ForEach-Object { '#{0}  count={1}' -f $_.Name, $_.Value }
