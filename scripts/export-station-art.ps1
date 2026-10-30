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
$sheets | ConvertTo-Json | Set-Content (Join-Path $runtimeRoot 'extraction.json')
Write-Output 'Exported four station atlases (16 frames each, 32x48).'
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
