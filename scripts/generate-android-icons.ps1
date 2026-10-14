Add-Type -AssemblyName System.Drawing

$rootDir = Split-Path -Parent $PSScriptRoot
$sourceIcon = Join-Path $rootDir "images\icon1.png"
$resDir = Join-Path $rootDir "android\app\src\main\res"

function Resize-Image($srcPath, $destPath, $targetWidth, $targetHeight, $paddingPercent = 0) {
    $src = [System.Drawing.Image]::FromFile($srcPath)
    $dest = New-Object System.Drawing.Bitmap($targetWidth, $targetHeight)
    $g = [System.Drawing.Graphics]::FromImage($dest)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    if ($paddingPercent -gt 0) {
        $padX = [int]($targetWidth * $paddingPercent / 2)
        $padY = [int]($targetHeight * $paddingPercent / 2)
        $drawW = $targetWidth - (2 * $padX)
        $drawH = $targetHeight - (2 * $padY)
        $g.DrawImage($src, $padX, $padY, $drawW, $drawH)
    } else {
        $g.DrawImage($src, 0, 0, $targetWidth, $targetHeight)
    }

    if (Test-Path $destPath) { Remove-Item $destPath -Force }
    $dest.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $dest.Dispose()
    $src.Dispose()
    Write-Host "Generated: $destPath ($($targetWidth)x$($targetHeight))"
}

function Create-SplashScreen($srcPath, $destPath, $w, $h) {
    $src = [System.Drawing.Image]::FromFile($srcPath)
    $dest = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($dest)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

    # Dark background matching theme
    $bgColor = [System.Drawing.ColorTranslator]::FromHtml("#08080f")
    $g.Clear($bgColor)

    # Center icon (around 25% to 35% of the shortest side)
    $iconSize = [int]([Math]::Min($w, $h) * 0.35)
    $posX = [int](($w - $iconSize) / 2)
    $posY = [int](($h - $iconSize) / 2)

    $g.DrawImage($src, $posX, $posY, $iconSize, $iconSize)

    if (Test-Path $destPath) { Remove-Item $destPath -Force }
    $dest.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $dest.Dispose()
    $src.Dispose()
    Write-Host "Generated Splash: $destPath ($($w)x$($h))"
}

# 1. Launcher Icons
$densities = @(
    @{ Name = "mipmap-mdpi"; Size = 48; Fore = 108 },
    @{ Name = "mipmap-hdpi"; Size = 72; Fore = 162 },
    @{ Name = "mipmap-xhdpi"; Size = 96; Fore = 216 },
    @{ Name = "mipmap-xxhdpi"; Size = 144; Fore = 324 },
    @{ Name = "mipmap-xxxhdpi"; Size = 192; Fore = 432 }
)

foreach ($d in $densities) {
    $dir = Join-Path $resDir $d.Name
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force }

    Resize-Image $sourceIcon (Join-Path $dir "ic_launcher.png") $d.Size $d.Size 0
    Resize-Image $sourceIcon (Join-Path $dir "ic_launcher_round.png") $d.Size $d.Size 0
    Resize-Image $sourceIcon (Join-Path $dir "ic_launcher_foreground.png") $d.Fore $d.Fore 0.28
}

# 2. Splash Screens
$splashes = @(
    @{ Dir = "drawable"; W = 480; H = 800 },
    @{ Dir = "drawable-port-mdpi"; W = 320; H = 480 },
    @{ Dir = "drawable-port-hdpi"; W = 480; H = 800 },
    @{ Dir = "drawable-port-xhdpi"; W = 720; H = 1280 },
    @{ Dir = "drawable-port-xxhdpi"; W = 960; H = 1600 },
    @{ Dir = "drawable-port-xxxhdpi"; W = 1280; H = 1920 },
    @{ Dir = "drawable-land-mdpi"; W = 480; H = 320 },
    @{ Dir = "drawable-land-hdpi"; W = 800; H = 480 },
    @{ Dir = "drawable-land-xhdpi"; W = 1280; H = 720 },
    @{ Dir = "drawable-land-xxhdpi"; W = 1600; H = 960 },
    @{ Dir = "drawable-land-xxxhdpi"; W = 1920; H = 1280 }
)

foreach ($s in $splashes) {
    $dir = Join-Path $resDir $s.Dir
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force }
    Create-SplashScreen $sourceIcon (Join-Path $dir "splash.png") $s.W $s.H
}

Write-Host "All Android icons and splash screens generated successfully!"
