# Optimises the certificate scans into JPEGs and emits them as data URIs.
# They are inlined into the 3D paper source because the certificate renders
# inside a sandboxed, opaque-origin iframe where a plain <img> URL would be
# cross-origin, and a data URI has no such dependency.
param(
  [int]$MaxWidth = 1400,
  [int]$Quality = 82
)

Add-Type -AssemblyName System.Drawing

# Windows PowerShell 5.1 reads BOM-less files as ANSI, which would mangle any
# literal U+00B7 into "Â·". Build the separator from its code point instead so
# the output is correct regardless of how this file is saved.
$dot = [string][char]0x00B7

$certs = @(
  @{ file = 'AI & Robotics 4 - Days Learning Certificates.png'
     title = 'Certificate of Participation'
     issuer = 'LBEF AI & Robotics Club'
     detail = "4-Day AI Learning Workshop $dot Jan 2026" },
  @{ file = 'Github Certificate.png'
     title = 'Certificate of Participation'
     issuer = 'LBEF Software Architect Club'
     detail = "GitHub Hands-On Workshop $dot Jan 2026" },
  @{ file = 'Coursera Foundation of Cyber Security.png'
     title = 'Foundations of Cybersecurity'
     issuer = "Coursera $dot Authorized by Google"
     detail = "Foundations of Cybersecurity $dot Jun 2026"
     href = 'https://coursera.org/verify/L6C77SGVQ7TW' },
  @{ file = 'Coursera Play It Safe.png'
     title = 'Play It Safe: Manage Security Risks'
     issuer = "Coursera $dot Authorized by Google"
     detail = "Play It Safe: Manage Security Risks $dot Jun 2026"
     href = 'https://coursera.org/verify/ZHT4MLNPW5NA' }
)

$encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
  Where-Object { $_.MimeType -eq 'image/jpeg' }

$out = @()

foreach ($c in $certs) {
  $src = [System.IO.Path]::Combine($PSScriptRoot, '..', $c.file)
  if (-not (Test-Path -LiteralPath $src)) {
    Write-Warning "Skipping missing file: $($c.file)"
    continue
  }

  $img = [System.Drawing.Image]::FromFile((Resolve-Path -LiteralPath $src).Path)
  $w = $img.Width
  $h = $img.Height
  if ($w -gt $MaxWidth) {
    $h = [int][math]::Round($img.Height * ($MaxWidth / $img.Width))
    $w = $MaxWidth
  }

  # Flatten onto white so PNG transparency does not become a black JPEG
  $bmp = New-Object System.Drawing.Bitmap($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::White)
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.SmoothingMode = 'HighQuality'
  $g.PixelOffsetMode = 'HighQuality'
  $g.DrawImage($img, 0, 0, $w, $h)
  $g.Dispose()
  $img.Dispose()

  $ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
    [System.Drawing.Imaging.Encoder]::Quality, $Quality)

  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, $encoder, $ep)
  $bytes = $ms.ToArray()
  $bmp.Dispose()
  $ms.Dispose()

  $b64 = [Convert]::ToBase64String($bytes)
  $out += [ordered]@{
    title   = $c.title
    issuer  = $c.issuer
    detail  = $c.detail
    href    = $c.href
    width   = $w
    height  = $h
    dataUri = "data:image/jpeg;base64,$b64"
  }

  Write-Host ("{0,-52} {1}x{2}  {3} KB" -f $c.file, $w, $h, [math]::Round($bytes.Length / 1KB))
}

$dest = [System.IO.Path]::Combine($PSScriptRoot, '..', 'src', 'certificates', 'certificates.data.json')
New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null

# Windows PowerShell 5.1's -Encoding UTF8 emits a BOM, which JSON.parse rejects.
$json = $out | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($dest, $json, (New-Object System.Text.UTF8Encoding($false)))

Write-Host ""
Write-Host ("Total data URI payload: {0} KB -> {1}" -f `
  [math]::Round((Get-Item $dest).Length / 1KB), $dest)
