# Station art source pack

## Station runtime export

`runtime/{player,backpack,suitcase,receptionist}.{png,json}` are Phaser atlases,
each with sixteen 32×48 frames. `runtime/extraction.json` and
`scripts/export-station-art.ps1` record and reproduce the manually inspected
source-cell exports. Source sheets remain intact. The station now loads its
labeled background and these small atlases at runtime; tax-office art is deferred.

## Arrival tutorial additions (2026-10-07)

Generated with the built-in ImageGen tool using the existing station and information-officer images as style references, using the warm chibi style references and prompt records in this asset folder.

- `local-assets/maps/loc_tax_office/source/npcs/npc_tax_clerk_source.png`: four directional rows of four walking poses and neutral/happy/confused portraits.
- `local-assets/maps/loc_tax_office/source/npcs/npc_tax_clerk_female_source.png`: Nadia's four directional walking poses and neutral/happy/confused portraits.
- `ui/ui_id_card_source.png`: fictional ID-card inventory icon, without personal data.
- `locations/location_station_map_labeled.png`: station map with TRAIN STATION, CAFE, and CLOTHES signs.
- `locations/location_tax_office_exterior_labeled.png`: exterior with TAX OFFICE sign.
- `locations/location_tax_office_interior_labeled.png`: interior with TAX OFFICE sign.
- `art_arrival_prompts.json`: complete generation and labeling prompts and style-reference paths.

Use the labeled location variants for the tutorial. Superseded unlabeled station and tax-office images were removed at the user's request. Prompt records retain historical filenames for provenance; those filenames are not live asset references. The clothing sign identifies an existing storefront illustration; it does not introduce clothing-shop gameplay.

These are high-resolution source PNGs, not runtime atlases or tile maps. Visually inspected for style, composition, character rows/portraits, and label spelling. Before Phaser integration, align and export walking frames at 32x48, portraits at 256x256, and pack atlas JSON. Walking consistency at native resolution still needs review. Export an appropriately sized ID icon. Author collision bounds and exits separately for flattened scene images. Some viewers display hidden gradient RGB under transparency; assess alpha against the actual game background before final export. Baked English signs can supplement accessible live location text during implementation.

No gameplay code changed for this art delivery; no runtime gameplay tests were performed.

Generated with the built-in ImageGen tool for the requested station scene. These are high-resolution source PNGs, not runtime atlases. No gameplay or seed content was changed.

## Files

- `characters/character_newcomer_source.png`: player walking poses and three dialogue expressions.
- `local-assets/maps/loc_station/source/npcs/npc_passenger_backpack_source.png`: backpack passenger poses and portraits.
- `local-assets/maps/loc_station/source/npcs/npc_passenger_suitcase_source.png`: suitcase passenger poses and portraits.
- `npcs/npc_station_information_source.png`: information officer poses and portraits.
- `locations/location_station_map_labeled.png`: station, food/drink store, clothing store and connecting concourse with readable signs.
- `ui/ui_dialogue_source.png`: empty dialogue panel, portrait frame, nameplate, buttons and icons.
- `palette.json`: intended shared warm palette; generated colors may vary.
- `art_prompts.json`: complete generation prompts.

## Before runtime integration

Use the `_transparent.png` variants for the newcomer, backpack passenger, information officer and dialogue UI, and the `_labeled.png` variants for location scenes. The suitcase passenger source also has transparent surroundings. Alpha-channel inspection confirms transparent empty sample points in the character and UI variants. Some image viewers show hidden RGB colors even where alpha is zero; use an alpha-aware viewer. Character and UI source images remain available for comparison.

Inspect and manually align/cut character frames to 32x48 pixels (four directions, four walking frames), export portraits at 256x256 (neutral, happy, confused), and pack sprites with atlas JSON. Generated sheets do not guarantee exact pixel alignment or animation consistency. UI components also require slicing. The map is flattened background art, not a reusable 32x32 tileset, collision map or navigation data. No atlas coordinates are supplied or assumed.

PNG transparency, dimensions and animation quality require final production validation. Preview PNG files directly; the app does not load this pack yet. Since this delivery changes only artwork and documentation, gameplay tests and local runtime integration were not performed.
