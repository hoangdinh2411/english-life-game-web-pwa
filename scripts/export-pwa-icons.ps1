# Purpose-made train/speech icon. Rebuild with PowerShell on Windows.
Add-Type -AssemblyName System.Drawing
$iconDirectory = Join-Path $PSScriptRoot '../apps/game/public/icons'
[IO.Directory]::CreateDirectory($iconDirectory) | Out-Null
foreach ($iconFile in @(@('icon-192.png',192), @('icon-512.png',512), @('maskable-512.png',512), @('apple-touch-icon.png',180))) {
  $iconSize = [int]$iconFile[1]
  $bitmap = [Drawing.Bitmap]::new($iconSize, $iconSize)
  $graphics = [Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.ScaleTransform($iconSize / 512.0, $iconSize / 512.0)
  $green = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#426f61'))
  $paper = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#fff8e9'))
  $ink = [Drawing.Pen]::new([Drawing.ColorTranslator]::FromHtml('#263630'), 14)
  $gold = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#ffe08a'))
  $graphics.FillRectangle($green, 0, 0, 512, 512)
  # Keep all foreground artwork inside the central mask-safe circle.
  $graphics.FillRectangle($paper, 152, 148, 208, 192)
  $graphics.FillEllipse($paper, 152, 116, 208, 64)
  $graphics.FillRectangle($green, 177, 172, 158, 73)
  $graphics.FillEllipse($gold, 179, 271, 30, 30)
  $graphics.FillEllipse($gold, 303, 271, 30, 30)
  $graphics.DrawLine($ink, 187, 340, 162, 378)
  $graphics.DrawLine($ink, 325, 340, 350, 378)
  $graphics.DrawLine($ink, 173, 365, 339, 365)
  $graphics.FillEllipse($gold, 312, 100, 78, 62)
  $graphics.FillPolygon($gold, [Drawing.Point[]]@([Drawing.Point]::new(326,147), [Drawing.Point]::new(314,174), [Drawing.Point]::new(353,154)))
  $bitmap.Save((Join-Path $iconDirectory $iconFile[0]), [Drawing.Imaging.ImageFormat]::Png)
  $ink.Dispose(); $green.Dispose(); $paper.Dispose(); $gold.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}
