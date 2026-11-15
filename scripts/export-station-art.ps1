Add-Type -AssemblyName System.Drawing
$repositoryRoot = Join-Path $PSScriptRoot '..'
$assetRoot = Join-Path $PSScriptRoot '../apps/game/assets'
$runtimeRoot = Join-Path $assetRoot 'runtime'
$stationMapRoot = Join-Path $PSScriptRoot '../local-assets/maps/loc_station'
New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
function Resolve-SourcePath([string]$file) {
  if ($file.StartsWith('local-assets/')) { return Join-Path $repositoryRoot $file }
  return Join-Path $assetRoot $file
}
# Manually inspected source cells. Export only, preserve all source artwork.
$sheets = @(
  @{ Name='player'; File='characters/character_newcomer_transparent.png'; X=120; Y=35; W=155; H=255; DX=210; DY=270 },
  @{ Name='backpack'; File='local-assets/maps/loc_station/source/npcs/npc_passenger_backpack_transparent.png'; X=90; Y=30; W=185; H=260; DX=215; DY=270 },
  @{ Name='receptionist'; File='npcs/npc_station_information_transparent.png'; X=75; Y=15; W=180; H=280; DX=230; DY=280 },
  @{ Name='suitcase'; File='local-assets/maps/loc_station/source/npcs/npc_passenger_suitcase_source.png'; X=250; Y=15; W=180; H=220; DX=200; DY=215 }
)
foreach ($sheet in $sheets) {
  $source = [System.Drawing.Bitmap]::new((Resolve-SourcePath $sheet.File))
  $atlas = [System.Drawing.Bitmap]::new(128,192,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($atlas)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $frames = [ordered]@{}
  for ($row=0; $row -lt 4; $row++) { for ($column=0; $column -lt 4; $column++) {
    $rect = [System.Drawing.Rectangle]::new($sheet.X+$column*$sheet.DX,$sheet.Y+$row*$sheet.DY,$sheet.W,$sheet.H)
    $destination = [System.Drawing.Rectangle]::new($column*32,$row*48,32,48)
    $graphics.DrawImage($source,$destination,$rect,[System.Drawing.GraphicsUnit]::Pixel)
    $frames["$row-$column"] = @{ frame=@{x=$column*32;y=$row*48;w=32;h=48}; rotated=$false; trimmed=$false; spriteSourceSize=@{x=0;y=0;w=32;h=48}; sourceSize=@{w=32;h=48} }
  } }
  $outputRoot = if ($sheet.Name -in @('backpack', 'suitcase')) { $stationMapRoot } else { $runtimeRoot }
  $atlasJson = if ($sheet.Name -in @('backpack', 'suitcase')) { $sheet.Name+'-atlas.json' } else { $sheet.Name+'.json' }
  $atlas.Save((Join-Path $outputRoot ($sheet.Name+'.png')),[System.Drawing.Imaging.ImageFormat]::Png)
  @{ frames=$frames; meta=@{image=$sheet.Name+'.png';size=@{w=128;h=192};scale='1'} } | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $outputRoot $atlasJson)
  $graphics.Dispose(); $atlas.Dispose(); $source.Dispose()
}
$maleSheet = $sheets[0]
$maleSource = [System.Drawing.Bitmap]::new((Resolve-SourcePath $maleSheet.File))
$rawMaleAtlas = [System.Drawing.Bitmap]::new(512,768,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$rawMaleGraphics = [System.Drawing.Graphics]::FromImage($rawMaleAtlas)
$rawMaleGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$maleAtlas = [System.Drawing.Bitmap]::new(512,768,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$maleGraphics = [System.Drawing.Graphics]::FromImage($maleAtlas)
$maleGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$maleFrames = [ordered]@{}
for ($row=0; $row -lt 4; $row++) { for ($column=0; $column -lt 4; $column++) {
  $rect = [System.Drawing.Rectangle]::new($maleSheet.X+$column*$maleSheet.DX,$maleSheet.Y+$row*$maleSheet.DY,$maleSheet.W,$maleSheet.H)
  $destination = [System.Drawing.Rectangle]::new($column*128,$row*192,128,192)
  $rawMaleGraphics.DrawImage($maleSource,$destination,$rect,[System.Drawing.GraphicsUnit]::Pixel)
} }
for ($row=0; $row -lt 4; $row++) {
  $bounds = @()
  for ($column=0; $column -lt 4; $column++) {
    $left=128; $right=-1; $top=192; $bottom=-1
    for ($y=0; $y -lt 192; $y++) { for ($x=0; $x -lt 128; $x++) {
      if ($rawMaleAtlas.GetPixel($column*128+$x,$row*192+$y).A -lt 16) { continue }
      $left=[Math]::Min($left,$x); $right=[Math]::Max($right,$x)
      $top=[Math]::Min($top,$y); $bottom=[Math]::Max($bottom,$y)
    } }
    if ($bottom -lt 0) { throw "Male player frame $row,$column has no visible pixels." }
    $bounds += @{ Left=$left; Right=$right; Top=$top; Bottom=$bottom; Height=$bottom-$top+1 }
  }
  $heights = @($bounds | ForEach-Object { $_.Height } | Sort-Object)
  $bottoms = @($bounds | ForEach-Object { $_.Bottom } | Sort-Object)
  $medianHeight = ($heights[1]+$heights[2])/2
  $medianBottom = ($bottoms[1]+$bottoms[2])/2
  $rowScale = 156/$medianHeight
  for ($column=0; $column -lt 4; $column++) {
    $targetWidth=[Math]::Round(128*$rowScale)
    $targetHeight=[Math]::Round(192*$rowScale)
    $targetX=$column*128+[Math]::Round((128-$targetWidth)/2)
    $targetY=$row*192+[Math]::Round(184-$medianBottom*$rowScale)
    $sourceRect=[System.Drawing.Rectangle]::new($column*128,$row*192,128,192)
    $targetRect=[System.Drawing.Rectangle]::new($targetX,$targetY,$targetWidth,$targetHeight)
    $maleGraphics.DrawImage($rawMaleAtlas,$targetRect,$sourceRect,[System.Drawing.GraphicsUnit]::Pixel)
  $maleFrames["$row-$column"] = @{ frame=@{x=$column*128;y=$row*192;w=128;h=192}; rotated=$false; trimmed=$false; spriteSourceSize=@{x=0;y=0;w=128;h=192}; sourceSize=@{w=128;h=192} }
  }
}
$maleAtlas.Save((Join-Path $runtimeRoot 'player-male.png'),[System.Drawing.Imaging.ImageFormat]::Png)
@{ frames=$maleFrames; meta=@{image='player-male.png';size=@{w=512;h=768};scale='1'} } | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $runtimeRoot 'player-male.json')
$maleGraphics.Dispose(); $maleAtlas.Dispose(); $rawMaleGraphics.Dispose(); $rawMaleAtlas.Dispose(); $maleSource.Dispose()
$maleExport = @{ Name='player-male'; File=$maleSheet.File; X=$maleSheet.X; Y=$maleSheet.Y; W=$maleSheet.W; H=$maleSheet.H; DX=$maleSheet.DX; DY=$maleSheet.DY; FrameWidth=128; FrameHeight=192 }
@($sheets) + @($maleExport) | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $runtimeRoot 'extraction.json')
Write-Output 'Exported four compact station atlases and the 128x192 saved male atlas.'
$portraits = @(
  @{ Name='player'; File='characters/character_newcomer_transparent.png'; X=20; Y=1115; W=320; H=380 },
  @{ Name='backpack'; File='local-assets/maps/loc_station/source/npcs/npc_passenger_backpack_transparent.png'; X=15; Y=1115; W=315; H=380 },
  @{ Name='receptionist'; File='npcs/npc_station_information_transparent.png'; X=20; Y=1125; W=315; H=395 },
  @{ Name='suitcase'; File='local-assets/maps/loc_station/source/npcs/npc_passenger_suitcase_source.png'; X=190; Y=890; W=295; H=330 }
)
foreach ($portrait in $portraits) {
  $source = [System.Drawing.Bitmap]::new((Resolve-SourcePath $portrait.File))
  $image = [System.Drawing.Bitmap]::new(256,256,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($image)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.DrawImage($source,[System.Drawing.Rectangle]::new(0,0,256,256),[System.Drawing.Rectangle]::new($portrait.X,$portrait.Y,$portrait.W,$portrait.H),[System.Drawing.GraphicsUnit]::Pixel)
  $outputRoot = if ($portrait.Name -in @('backpack', 'suitcase')) { $stationMapRoot } else { $runtimeRoot }
  $image.Save((Join-Path $outputRoot ($portrait.Name+'-portrait.png')),[System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose(); $image.Dispose(); $source.Dispose()
}
$portraits | ConvertTo-Json | Set-Content (Join-Path $runtimeRoot 'portrait-extraction.json')
