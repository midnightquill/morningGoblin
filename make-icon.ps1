Add-Type -AssemblyName System.Drawing

$size = 512
$bitmap = New-Object System.Drawing.Bitmap $size, $size
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.Clear([System.Drawing.Color]::Transparent)

function New-Color($hex) {
  return [System.Drawing.ColorTranslator]::FromHtml($hex)
}

$bgRect = New-Object System.Drawing.Rectangle 0, 0, $size, $size
$bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  $bgRect,
  (New-Color '#FFB347'),
  (New-Color '#FF7A18'),
  135
)
$graphics.FillRectangle($bgBrush, $bgRect)

$haloBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(70, 255, 244, 204))
$graphics.FillEllipse($haloBrush, 100, 62, 312, 312)

$sunBrush = New-Object System.Drawing.SolidBrush (New-Color '#FFE599')
$graphics.FillEllipse($sunBrush, 66, 72, 84, 84)

$rayPen = New-Object System.Drawing.Pen ((New-Color '#FFEFC2'), 12)
$rayPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$rayPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$graphics.DrawLine($rayPen, 108, 36, 108, 12)
$graphics.DrawLine($rayPen, 72, 52, 56, 36)
$graphics.DrawLine($rayPen, 144, 52, 160, 36)

$earColor = New-Color '#5B8C2A'
$headColor = New-Color '#7CB342'
$innerEarColor = New-Color '#F2B7A8'
$shadowColor = [System.Drawing.Color]::FromArgb(55, 55, 25, 10)
$featureColor = New-Color '#2A261F'
$mouthColor = New-Color '#6B2D24'
$toothColor = New-Color '#FFF6E5'
$cheekColor = [System.Drawing.Color]::FromArgb(75, 255, 184, 140)

$shadowBrush = New-Object System.Drawing.SolidBrush $shadowColor
$graphics.FillEllipse($shadowBrush, 138, 168, 236, 250)

$leftEar = New-Object System.Drawing.Drawing2D.GraphicsPath
$leftEar.AddPolygon(@(
  (New-Object System.Drawing.Point 108, 188),
  (New-Object System.Drawing.Point 154, 124),
  (New-Object System.Drawing.Point 195, 215)
))
$rightEar = New-Object System.Drawing.Drawing2D.GraphicsPath
$rightEar.AddPolygon(@(
  (New-Object System.Drawing.Point 404, 188),
  (New-Object System.Drawing.Point 358, 124),
  (New-Object System.Drawing.Point 317, 215)
))
$earBrush = New-Object System.Drawing.SolidBrush $earColor
$graphics.FillPath($earBrush, $leftEar)
$graphics.FillPath($earBrush, $rightEar)

$leftInnerEar = New-Object System.Drawing.Drawing2D.GraphicsPath
$leftInnerEar.AddPolygon(@(
  (New-Object System.Drawing.Point 138, 184),
  (New-Object System.Drawing.Point 156, 151),
  (New-Object System.Drawing.Point 175, 198)
))
$rightInnerEar = New-Object System.Drawing.Drawing2D.GraphicsPath
$rightInnerEar.AddPolygon(@(
  (New-Object System.Drawing.Point 374, 184),
  (New-Object System.Drawing.Point 356, 151),
  (New-Object System.Drawing.Point 337, 198)
))
$innerEarBrush = New-Object System.Drawing.SolidBrush $innerEarColor
$graphics.FillPath($innerEarBrush, $leftInnerEar)
$graphics.FillPath($innerEarBrush, $rightInnerEar)

$headBrush = New-Object System.Drawing.SolidBrush $headColor
$graphics.FillEllipse($headBrush, 136, 136, 240, 240)

$eyebrowPen = New-Object System.Drawing.Pen ($featureColor, 10)
$eyebrowPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$eyebrowPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$graphics.DrawArc($eyebrowPen, 182, 198, 50, 18, 190, 150)
$graphics.DrawArc($eyebrowPen, 280, 198, 50, 18, 200, 150)

$eyePen = New-Object System.Drawing.Pen ($featureColor, 12)
$eyePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$eyePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$graphics.DrawLine($eyePen, 188, 238, 226, 236)
$graphics.DrawLine($eyePen, 286, 236, 324, 238)

$cheekBrush = New-Object System.Drawing.SolidBrush $cheekColor
$graphics.FillEllipse($cheekBrush, 170, 254, 42, 26)
$graphics.FillEllipse($cheekBrush, 300, 254, 42, 26)

$mouthPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$mouthPath.AddArc(196, 258, 120, 78, 10, 160)
$mouthPath.AddArc(208, 270, 96, 54, 190, -160)
$mouthPath.CloseFigure()
$mouthBrush = New-Object System.Drawing.SolidBrush $mouthColor
$graphics.FillPath($mouthBrush, $mouthPath)

$toothBrush = New-Object System.Drawing.SolidBrush $toothColor
$graphics.FillRectangle($toothBrush, 244, 281, 18, 24)

$mugBodyBrush = New-Object System.Drawing.SolidBrush (New-Color '#F7F2EA')
$mugAccentBrush = New-Object System.Drawing.SolidBrush (New-Color '#D6CDBF')
$graphics.FillRectangle($mugBodyBrush, 312, 332, 74, 56)
$graphics.FillRectangle($mugAccentBrush, 312, 332, 74, 10)
$mugPen = New-Object System.Drawing.Pen ((New-Color '#F7F2EA'), 10)
$graphics.DrawArc($mugPen, 374, 344, 28, 26, 270, 220)

$steamPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(185, 255, 250, 240), 7)
$steamPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$steamPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$graphics.DrawBezier($steamPen, 328, 336, 322, 318, 342, 310, 336, 292)
$graphics.DrawBezier($steamPen, 352, 336, 346, 316, 366, 308, 360, 290)

$badgeBrush = New-Object System.Drawing.SolidBrush (New-Color '#2A261F')
$graphics.FillEllipse($badgeBrush, 92, 344, 104, 104)
$badgeTextBrush = New-Object System.Drawing.SolidBrush (New-Color '#FFE599')
$font = New-Object System.Drawing.Font('Segoe UI Black', 30, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$format = New-Object System.Drawing.StringFormat
$format.Alignment = [System.Drawing.StringAlignment]::Center
$format.LineAlignment = [System.Drawing.StringAlignment]::Center
$graphics.DrawString('GM', $font, $badgeTextBrush, (New-Object System.Drawing.RectangleF 92, 344, 104, 104), $format)

$borderPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(45, 75, 30, 10), 8)
$graphics.DrawEllipse($borderPen, 18, 18, 476, 476)

$pngPath = Join-Path (Get-Location) 'assets/morning-goblin-icon.png'
$bitmap.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)

$format.Dispose()
$font.Dispose()
$borderPen.Dispose()
$badgeTextBrush.Dispose()
$badgeBrush.Dispose()
$steamPen.Dispose()
$mugPen.Dispose()
$mugAccentBrush.Dispose()
$mugBodyBrush.Dispose()
$toothBrush.Dispose()
$mouthBrush.Dispose()
$mouthPath.Dispose()
$cheekBrush.Dispose()
$eyePen.Dispose()
$eyebrowPen.Dispose()
$headBrush.Dispose()
$innerEarBrush.Dispose()
$leftInnerEar.Dispose()
$rightInnerEar.Dispose()
$earBrush.Dispose()
$leftEar.Dispose()
$rightEar.Dispose()
$shadowBrush.Dispose()
$rayPen.Dispose()
$sunBrush.Dispose()
$haloBrush.Dispose()
$bgBrush.Dispose()
$graphics.Dispose()
$bitmap.Dispose()
