# Art Style Guide

Use this file only when the current task creates, edits, names, reviews,
integrates, or uploads an art/audio asset. For such a task, open only the
references and supporting files needed for that specific asset; do not scan the
entire `docs/art-direction/` directory.

## Step 1: Look at the references (always)

- Open only the relevant images in `docs/art-direction/refs/` before you create
  anything.
- The refs decide the LOOK (shapes, outline, shading, colors).
- This file decides the TECHNICAL rules (sizes, names, formats).
- If the refs folder is empty or you cannot open it, stop and ask.

### Reference routing

Open only the files required by the current asset:

- Urban exteriors and outdoor town layouts:
  `refs/building-urban-exteriors-reference.png`.
- Customer-facing commercial interiors, including hospitality and retail:
  `refs/building-commercial-interiors-reference.png`.
- Civic, public-service, and educational interiors:
  `refs/building-civic-interiors-reference.png`.

Choose a building reference by functional category, not by matching one named
venue. New buildings in the same category must preserve that category's camera,
materials, spatial density, palette, lighting, and architectural language.
- NPC identity and diversity: `refs/npc-diversity-reference.png`.
- NPC walking motion and technical layout: `refs/npc-walking-reference.png`.
- NPC dialogue expressions: `refs/npc-portrait-reference.png`.
- UI components: `refs/ui-components-reference.png`. This defines visual
  direction only; it does not replace semantic color tokens, accessibility
  behavior, responsive layout, or implementation tests.
- Inventory objects and standalone props: `refs/props-items-reference.png`.

Do not open unrelated references. Night lighting, weather, and VFX have no
approved reference because those mechanics are not currently in scope; ask
before defining them.

## Mandatory style and approval contract

- Treat the references and the completed Visual style section as constraints,
  not inspiration. Do not add unrequested characters, props, text, colors,
  lighting, camera angles, moods, or decorative details.
- When a requested detail is not defined by the task or references, stop and
  ask. Do not fill the gap with an AI-generated creative choice.
- Generate only the requested variants. Do not create optional alternatives
  unless the user asks for them.
- A generated file is a draft until the user completes both approval gates
  below. Approval of the visual result does not authorize integration or
  production upload.

### Gate 1: visual approval

After generation, display every generated image in the chat with its proposed
name, owner/map, dimensions, format, and intended runtime role. Ask the user to
approve the visual result. If it is rejected, revise and display it again. Do
not register, package, upload, or use the draft while this gate is pending.

### Gate 2: permission to use

After visual approval, separately ask whether the approved asset may be used in
the project. Only an explicit yes authorizes moving/copying it into its reviewed
source location and updating code, content catalogs, manifests, generation
scripts, tests, or documentation that references it. Approval must identify the
shown asset or clearly apply to the shown group.

### Gate 3: production-upload approval

Permission to use an asset does not authorize a production mutation. First
integrate it locally, generate and inspect the runtime pack, run relevant tests,
and run the production upload command in dry-run mode. Show the user the exact
production command, target map, proposed upload/update counts, versions, and any
validation failures. Ask for explicit production-upload approval. Only then may
the non-dry-run production command be executed. Never interpret “looks good” or
“use it” as production-upload approval.

## Visual style

(Fill once from the refs. Describe only what you can see. Do not invent.)

- Camera angle:
- Outline:
- Shading:
- Palette (hex codes):
- Light direction:
- Level of detail:
- Proportions:

## Technical rules

- Tile: 32x32 px
- Player sprite: 32x48 px per frame, 4 directions, 4-frame walk
- NPC sprite: 128x192 px per frame in a 512x768 RGBA sheet. Use
  `refs/npc-walking-reference.png` as the technical pose, spacing, direction,
  and motion reference. Rows are front, left, right, back; columns are the four
  distinct walk-cycle poses. Every cell must retain transparent padding and no
  sprite may touch or cross a cell boundary.
- Dialogue portrait: three 256x256 px frames in one 768x256 RGBA strip. Use
  `refs/npc-portrait-reference.png`; order is neutral, happy, confused.
- Format: PNG with transparency
- Sprite sheets: atlas + JSON (TexturePacker or similar)
- Colors: only from `palette.json`
- Audio: OGG + MP3 fallback, music loops under 1 MB, voice 64 kbps mono
- No real art yet? Use a plain rectangle with the same size.

## Naming

`type_name_variant.png`, lowercase, ASCII only, no spaces. Examples:
`npc_mia_walk.png`, `tile_street_01.png`, `ui_button_primary.png` Never use
`final`, `new`, or `copy`. Add the town or owner name if two assets could
collide.

## Where new images are stored

Choose the destination by ownership. Do not place every generated image in the
root of `local-assets/`.

| Image purpose | Store the reviewed source here | Runtime output |
| --- | --- | --- |
| One remote map, such as a background or map-specific NPC | `local-assets/maps/<mapId>/source/<category>/` | `local-assets/maps/<mapId>/` after generation/export |
| Shared or bundled game art used by more than one map | `apps/game/assets/<category>/` | Imported by the client or copied into a generated map pack |
| Per-NPC walking sheet and portraits referenced by content | `apps/game/assets/npcs/<npc-id>/walk.png` and `apps/game/assets/npcs/<npc-id>/portraits.png` | Copied into the relevant map pack by `pnpm assets:generate` |
| PWA icon or other browser-public file | `apps/game/public/<category>/` | Served directly by Vite |

`<mapId>` is the server location ID, for example `loc_cafe` or
`loc_town_street`. Use a focused category below `source/`, such as `backgrounds/`,
`npcs/`, `props/`, or `ui/`.

Important distinctions:

- `local-assets/` is ignored by Git. It is the local review and map-pack area,
  not a durable team archive. Back up an approved source outside the repository
  before deleting or replacing it.
- Files directly inside `local-assets/maps/<mapId>/` are publishable runtime
  files. The sync script intentionally excludes the `source/` directory.
- `apps/game/assets/` is tracked source for bundled/shared assets. Do not put a
  map-only draft there merely to make it persistent.
- AI tool output is not automatically a game asset. Move the selected result
  into the correct reviewed-source location, rename it, and validate it first.
- Runtime-generated speech belongs to the backend's private speech storage; it
  does not follow this static-image workflow.

## Workflow

1. Identify the owner before generation: one map, one NPC, shared game art, or
   browser-public art.
2. Generate map-specific drafts under
   `local-assets/maps/<mapId>/source/<category>/`. For tracked shared assets,
   generate to a temporary/local review location first and copy only the
   approved result into `apps/game/assets/<category>/`.
3. Compare the result with `docs/art-direction/refs/`; fix style, dimensions,
   transparency, palette, and naming before integration.
4. Display every generated image and wait for Gate 1 visual approval.
5. Ask separately for Gate 2 permission to use the approved asset. Stop if the
   user does not explicitly approve its use.
6. Move/copy the approved file into its reviewed source location. Register it
   in the relevant content/catalog, typed manifest, and asset-generation script.
   Update the loader/scene, tests, and maintained documentation when required.
   A file existing on disk does not make the game load it.
7. Run `pnpm assets:generate <mapId>` to rebuild that map's runtime pack. If a
   specialized export script owns the asset, run that exporter first.
8. Inspect `local-assets/maps/<mapId>/`. Keep editable/source files under
   `source/`; only runtime files belong at the map-folder root.
9. Preview local or staging changes with the applicable dry-run command. For
   production, run only
   `pnpm assets:upload -- --dry-run --target production <mapId>`, report the
   result, and wait for Gate 3 production-upload approval.
10. After Gate 3 approval, publish with
    `pnpm assets:upload -- --target production <mapId>`. Production credentials
    must come from the deployment environment, and the upload must go through
    the NestJS content API; never write directly to the database or Storage.
11. Verify the remote metadata/checksum and affected game flow. Load assets per
    town (lazy); never load every town's assets at startup.

## Before you finish, check

- [ ] Looks like the refs
- [ ] Contains no unrequested creative additions
- [ ] Correct size and format
- [ ] Correct name
- [ ] Colors are in `palette.json`
- [ ] Gate 1 visual approval is recorded
- [ ] Gate 2 permission to use is recorded
- [ ] Reviewed source is in the correct ownership folder
- [ ] Runtime pack was regenerated and inspected
- [ ] Dry-run reports only the expected uploads or version updates
- [ ] Production upload did not run without separate Gate 3 approval
