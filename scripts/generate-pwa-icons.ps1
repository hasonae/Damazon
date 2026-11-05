<#
.SYNOPSIS
  Generates every application icon from the master Damazon logo.

.DESCRIPTION
  The logo artwork is cropped to its opaque bounding box, then re-composited
  into each size the applications reference:

    favicon-32.png / favicon-48.png  transparent, square, ~10% padding
    pwa-192.png / pwa-512.png        transparent "any" install icons, 12% padding
    pwa-maskable-512.png             cream safe-zone background, 25% padding
    apple-touch-icon.png             opaque white (iOS ignores alpha), 12% padding

  Run after changing `Damazon logo.png`:
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/generate-pwa-icons.ps1
#>
param(
  [string]$LogoPath = (Join-Path (Split-Path -Parent $PSScriptRoot) 'Damazon logo.png')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
if (-not [System.IO.Path]::IsPathRooted($LogoPath)) {
  $LogoPath = Join-Path $root $LogoPath
}
$targets = @(
  (Join-Path $root 'apps\customer-pwa\public'),
  (Join-Path $root 'apps\admin-pwa\public')
)

$source = New-Object System.Drawing.Bitmap($LogoPath)

# 1. Crop the transparent margins away so the mark fills each icon.
$minX = $source.Width; $minY = $source.Height; $maxX = -1; $maxY = -1
for ($y = 0; $y -lt $source.Height; $y++) {
  for ($x = 0; $x -lt $source.Width; $x++) {
    if ($source.GetPixel($x, $y).A -gt 8) {
      if ($x -lt $minX) { $minX = $x }
      if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }
      if ($y -gt $maxY) { $maxY = $y }
    }
  }
}
if ($maxX -lt 0) { throw 'Logo has no visible artwork.' }
$cropW = $maxX - $minX + 1
$cropH = $maxY - $minY + 1

function New-IconBitmap {
  param(
    [int]$Size,
    [double]$Fill,
    [System.Drawing.Color]$Background,
    [bool]$Opaque
  )
  $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear($(if ($Opaque) { $Background } else { [System.Drawing.Color]::Transparent }))

  $box = [int]($Size * $Fill)
  if ($script:cropW -ge $script:cropH) {
    $drawW = $box
    $drawH = [int]([Math]::Round($box * $script:cropH / [double]$script:cropW))
  } else {
    $drawH = $box
    $drawW = [int]([Math]::Round($box * $script:cropW / [double]$script:cropH))
  }
  $dx = [int](($Size - $drawW) / 2)
  $dy = [int](($Size - $drawH) / 2)
  $srcRect = New-Object System.Drawing.Rectangle($script:minX, $script:minY, $script:cropW, $script:cropH)
  $dstRect = New-Object System.Drawing.Rectangle($dx, $dy, $drawW, $drawH)
  $g.DrawImage($source, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()
  return $bmp
}

$cream = [System.Drawing.Color]::FromArgb(255, 252, 246, 241)
$white = [System.Drawing.Color]::FromArgb(255, 255, 255, 255)

$spec = @(
  @{ Name = 'favicon-32.png';          Size = 32;  Fill = 0.80; Bg = $white; Opaque = $false },
  @{ Name = 'favicon-48.png';          Size = 48;  Fill = 0.80; Bg = $white; Opaque = $false },
  @{ Name = 'pwa-192.png';             Size = 192; Fill = 0.76; Bg = $white; Opaque = $false },
  @{ Name = 'pwa-512.png';             Size = 512; Fill = 0.76; Bg = $white; Opaque = $false },
  @{ Name = 'pwa-maskable-512.png';    Size = 512; Fill = 0.60; Bg = $cream; Opaque = $true },
  @{ Name = 'apple-touch-icon.png';    Size = 180; Fill = 0.76; Bg = $white; Opaque = $true }
)

$written = @()
foreach ($dir in $targets) {
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
  foreach ($icon in $spec) {
    $bmp = New-IconBitmap -Size $icon.Size -Fill $icon.Fill -Background $icon.Bg -Opaque $icon.Opaque
    $out = Join-Path $dir $icon.Name
    $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    $written += $out
  }
}

$source.Dispose()
Write-Output ('Generated {0} icons from {1}' -f $written.Count, $LogoPath)
$written | ForEach-Object { Write-Output ("  " + $_) }
