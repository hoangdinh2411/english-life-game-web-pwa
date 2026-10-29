Add-Type -AssemblyName System.Drawing
$mapAssetRoot = Join-Path $PSScriptRoot '../local-assets/maps/loc_tax_office'
$characters = @(
  @{ Id = 'npc_tax_clerk_marcus'; Source = (Join-Path $mapAssetRoot 'source/npcs/npc_tax_clerk_source.png') },
  @{ Id = 'npc_tax_clerk_nadia'; Source = (Join-Path $mapAssetRoot 'source/npcs/npc_tax_clerk_female_source.png') }
)
function Get-VisibleBounds([System.Drawing.Bitmap]$image, [System.Drawing.Rectangle]$cell) {
  $left=$cell.Right; $top=$cell.Bottom; $right=-1; $bottom=-1
  for ($y=$cell.Top; $y -lt $cell.Bottom; $y++) { for ($x=$cell.Left; $x -lt $cell.Right; $x++) {
    if ($image.GetPixel($x,$y).A -lt 16) { continue }
    $left=[Math]::Min($left,$x); $top=[Math]::Min($top,$y); $right=[Math]::Max($right,$x); $bottom=[Math]::Max($bottom,$y)
  } }
  if ($right -lt 0) { throw "Empty source cell at $($cell.X),$($cell.Y)." }
  [System.Drawing.Rectangle]::FromLTRB($left,$top,$right+1,$bottom+1)
}
foreach ($character in $characters) {
  $source=[System.Drawing.Bitmap]::new($character.Source)
  if ($source.Width -ne 1024 -or $source.Height -ne 1536) { throw "$($character.Source) must be 1024x1536." }
  $walk=[System.Drawing.Bitmap]::new(512,768,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics=[System.Drawing.Graphics]::FromImage($walk); $graphics.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  for ($row=0; $row -lt 4; $row++) { for ($column=0; $column -lt 4; $column++) {
    # Generated rows may bleed a few pixels across cell boundaries; skip that gutter.
    $bounds=Get-VisibleBounds $source ([System.Drawing.Rectangle]::new($column*256,$row*288+16,256,272))
    $scale=[Math]::Min(116.0/$bounds.Width,156.0/$bounds.Height); $width=[Math]::Round($bounds.Width*$scale); $height=[Math]::Round($bounds.Height*$scale)
    $destination=[System.Drawing.Rectangle]::new($column*128+[Math]::Floor((128-$width)/2),$row*192+184-$height,$width,$height)
    $graphics.DrawImage($source,$destination,$bounds,[System.Drawing.GraphicsUnit]::Pixel)
  } }
  $graphics.Dispose()
  # The shared runtime contract derives right-facing frames from the left row.
  for ($column=0; $column -lt 4; $column++) {
    for ($y=0; $y -lt 192; $y++) { for ($x=0; $x -lt 128; $x++) {
      $walk.SetPixel($column*128+$x,384+$y,$walk.GetPixel($column*128+127-$x,192+$y))
    } }
  }
  # Keep frame gutters transparent even when bicubic sampling reaches outside the crop.
  for ($row=0; $row -lt 4; $row++) {
    for ($y=0; $y -lt 8; $y++) { for ($x=0; $x -lt 512; $x++) {
      $walk.SetPixel($x,$row*192+$y,[System.Drawing.Color]::Transparent)
    } }
  }
  $walk.Save((Join-Path $mapAssetRoot "npc-$($character.Id).png"),[System.Drawing.Imaging.ImageFormat]::Png); $walk.Dispose()
  $portraits=[System.Drawing.Bitmap]::new(768,256,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics=[System.Drawing.Graphics]::FromImage($portraits); $graphics.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  for ($column=0; $column -lt 3; $column++) {
    $left=[Math]::Round($column*1024/3); $right=[Math]::Round(($column+1)*1024/3)
    $bounds=Get-VisibleBounds $source ([System.Drawing.Rectangle]::new($left,1168,$right-$left,368))
    $scale=[Math]::Min(246.0/$bounds.Width,246.0/$bounds.Height); $width=[Math]::Round($bounds.Width*$scale); $height=[Math]::Round($bounds.Height*$scale)
    $destination=[System.Drawing.Rectangle]::new($column*256+[Math]::Floor((256-$width)/2),251-$height,$width,$height)
    $graphics.DrawImage($source,$destination,$bounds,[System.Drawing.GraphicsUnit]::Pixel)
  }
  $portraits.Save((Join-Path $mapAssetRoot "portrait-$($character.Id).png"),[System.Drawing.Imaging.ImageFormat]::Png); $graphics.Dispose(); $portraits.Dispose(); $source.Dispose()
}
Write-Output 'Exported Tax Office walking sheets and portrait strips.'
