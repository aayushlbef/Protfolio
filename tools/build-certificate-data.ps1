# Optimises the certificate scans into JPEGs and emits them as data URIs.
# They are inlined into the 3D paper source because the certificate renders
# inside a sandboxed, opaque-origin iframe where a plain <img> URL would be
# cross-origin, and a data URI has no such dependency.
param(
  [int]$MaxWidth = 1400,
  [int]$MaxHeight = 990,
  [int]$Quality = 82,
  [int]$ThumbWidth = 480,
  [int]$ThumbHeight = 340
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

$thumbDir = [System.IO.Path]::Combine($PSScriptRoot, '..', 'public', 'images', 'certificates')
New-Item -ItemType Directory -Force -Path $thumbDir | Out-Null
Get-ChildItem -Path $thumbDir -Filter 'cert-*.jpg' -ErrorAction SilentlyContinue |
  Remove-Item -Force

$out = @()
$meta = @()

foreach ($c in $certs) {
  # The source scans live beside the generated ones, in the same public
  # certificates folder - they used to sit loose in the project root.
  $src = [System.IO.Path]::Combine($thumbDir, $c.file)
  if (-not (Test-Path -LiteralPath $src)) {
    Write-Warning "Skipping missing file: $($c.file)"
    continue
  }

  $img = [System.Drawing.Image]::FromFile((Resolve-Path -LiteralPath $src).Path)

  # Every scan is normalised onto the same landscape sheet (MaxWidth x
  # MaxHeight) and centred on white, so the 3D sheet can be exactly that
  # aspect and the image covers it edge to edge with no paper showing. All four
  # certificates have light backgrounds, so the padding is invisible.
  $scale = [math]::Min($MaxWidth / $img.Width, $MaxHeight / $img.Height)
  $w = [int][math]::Round($img.Width * $scale)
  $h = [int][math]::Round($img.Height * $scale)
  $dx = [int][math]::Round(($MaxWidth - $w) / 2)
  $dy = [int][math]::Round(($MaxHeight - $h) / 2)

  # Flatten onto white so PNG transparency does not become a black JPEG
  $bmp = New-Object System.Drawing.Bitmap($MaxWidth, $MaxHeight)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::White)
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.SmoothingMode = 'HighQuality'
  $g.PixelOffsetMode = 'HighQuality'
  $g.DrawImage($img, $dx, $dy, $w, $h)
  $g.Dispose()
  $img.Dispose()

  $ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
    [System.Drawing.Imaging.Encoder]::Quality, $Quality)

  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, $encoder, $ep)
  $bytes = $ms.ToArray()
  $ms.Dispose()

  $b64 = [Convert]::ToBase64String($bytes)
  $n = $out.Count + 1
  $out += [ordered]@{
    title   = $c.title
    issuer  = $c.issuer
    detail  = $c.detail
    href    = $c.href
    width   = $MaxWidth
    height  = $MaxHeight
    dataUri = "data:image/jpeg;base64,$b64"
  }

  # A small on-disk thumbnail for the prev/next cards. These are referenced by
  # URL from the parent page, so they must be real files rather than data URIs
  # (which would pull the full-size scans into the main bundle). Derived before
  # $bmp is disposed.
  $thumbScale = [math]::Min($ThumbWidth / $MaxWidth, $ThumbHeight / $MaxHeight)
  $tw = [int][math]::Round($MaxWidth * $thumbScale)
  $th = [int][math]::Round($MaxHeight * $thumbScale)
  $tbmp = New-Object System.Drawing.Bitmap($tw, $th)
  $tg = [System.Drawing.Graphics]::FromImage($tbmp)
  $tg.InterpolationMode = 'HighQualityBicubic'
  $tg.SmoothingMode = 'HighQuality'
  $tg.PixelOffsetMode = 'HighQuality'
  $tg.DrawImage($bmp, 0, 0, $tw, $th)
  $tg.Dispose()
  $bmp.Dispose()

  $thumbName = 'cert-{0:d2}.jpg' -f $n
  $thumbPath = [System.IO.Path]::Combine($thumbDir, $thumbName)
  $tbmp.Save($thumbPath, $encoder, $ep)
  $tbmp.Dispose()

  $meta += [ordered]@{
    index  = $n
    title  = $c.title
    issuer = $c.issuer
    detail = $c.detail
    href   = $c.href
    thumb  = $thumbName
  }

  Write-Host ("{0,-52} {1}x{2}  {3} KB   thumb {4}x{5}" -f `
    $c.file, $MaxWidth, $MaxHeight, [math]::Round($bytes.Length / 1KB), $tw, $th)
}

$dest = [System.IO.Path]::Combine($PSScriptRoot, '..', 'src', 'certificates', 'certificates.data.json')
New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null

# Windows PowerShell 5.1's -Encoding UTF8 emits a BOM, which JSON.parse rejects.
$json = $out | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($dest, $json, (New-Object System.Text.UTF8Encoding($false)))

# Metadata only, with no data URIs, so the React island can import it cheaply.
$metaDest = [System.IO.Path]::Combine($PSScriptRoot, '..', 'src', 'certificates', 'certificates.meta.json')
$metaJson = $meta | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText($metaDest, $metaJson, (New-Object System.Text.UTF8Encoding($false)))

Write-Host ""
Write-Host ("Total data URI payload: {0} KB -> {1}" -f `
  [math]::Round((Get-Item $dest).Length / 1KB), (Split-Path $dest -Leaf))
Write-Host ("Thumbnails: {0} -> {1}" -f $thumbDir, $meta.Count)
Write-Host ("Metadata: {0} bytes" -f (Get-Item $metaDest).Length)
