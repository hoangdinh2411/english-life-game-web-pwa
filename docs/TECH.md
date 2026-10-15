# TECH — current architecture and setup

## Current stack (D16, 2026-10-11)
| Area | Implementation |
| --- | --- |
| Client | `apps/game`: Vite 8, React DOM 19, strict TypeScript, Phaser 4, installable browser PWA |
| UI styling | Tailwind CSS 4.3 through the official `@tailwindcss/vite` plugin; component-local utilities |
| Server | `apps/server`: NestJS 11, API and server-authoritative gameplay |
| Data/auth | PostgreSQL and Supabase Auth; public Storage for versioned destination packs |
| Shared | `packages/shared`: game logic, Zod schemas and API contracts |
| Content | Validated JSON: catalogs and NPC-specific dialogue seed to Postgres; shared global/role scripts load from server files |
| Tooling | pnpm workspace, Node >=20.19; Docker for local Supabase |

**No Expo, React Native, WebView, native build or second client.** Redis is
optional later, not a required development service today.

## UI styling

- Style React UI with Tailwind utilities in `className`. Use complete, literal
  class names in conditional branches so Tailwind can detect them at build time;
  do not construct names such as `bg-${color}`. Runtime values such as energy
  width and selected avatar color remain inline styles.
- `apps/game/vite.config.ts` runs `@tailwindcss/vite`; there is no CDN, runtime
  style generation, PostCSS configuration or separate Tailwind config file.
- `apps/game/src/styles.css` contains Tailwind imports, `@theme` color/font
  tokens, shared element defaults and sleep keyframes. Use `text-ink`,
  `bg-paper`, `bg-card`, `bg-green` and other theme utilities. Keep ordinary
  component layout, responsive rules and states in JSX rather than adding
  named CSS selectors. Existing semantic class markers support state/descendant
  variants and UI inspection; their visual styles are Tailwind utilities.
- Preflight is deliberately omitted to preserve existing browser form defaults.
  The theme and utilities are imported separately; existing global defaults
  use `@layer base` and `@apply`. Preserve 44px controls, focus outlines,
  safe-area offsets, existing mobile breakpoints and reduced-motion behavior.
- `pnpm dev:game` compiles utilities during development. Verify styling changes
  with `pnpm --filter game test`, `pnpm typecheck`, `pnpm lint`,
  `pnpm --filter game build` and `pnpm check:pwa`, plus responsive browser checks
  at 320/375px and tablet/desktop widths. Generated CSS remains a public PWA asset.
  `/tests/ui-styles-browser.html` is a development-only fixture for the real
  onboarding/dialogue components and their selected, disabled, error and focus
  states; it uses fictional data and never calls Auth or gameplay APIs.

## Code organization (target for new work; no bulk migration)

**Client: feature-first.** `src/App.tsx`, `src/app` and `src/navigation` compose
screens/routes. A feature owns its React UI, state, optional API adapter and
Phaser integration. `shared/` is only for code reused by multiple features:

```text
apps/game/src/
  app/                    # routes/composition, not business logic
  features/
    onboarding/           # flow-specific UI + state
    station/              # receptionist, practice + arrival world/scene
      components/         # React dialogue/HUD pieces
      hooks/              # UI interaction state
      game/               # Phaser scene, movement, world adapters
      api/                # calls to server for authenticated arrival
    dialogue/             # reusable conversation feature UI
    npcs/                 # shared movement engine and per-NPC patrol profiles
    minimap/              # visible-only 10 Hz scene snapshots and canvas HUD
    quests/               # quest/ticket status UI
  shared/                 # reused UI/hooks/helpers ONLY when necessary
```

These are **placement examples, not folders to pre-create**. A small feature
can be a single file. Co-locate related components/hooks/tests; split when a
file mixes responsibilities or becomes difficult to navigate, not to meet a
line-count rule. Keep the dependency direction `app → features → shared`;
features should not reach into another feature's private internals. Game rules
shared with the server belong in `packages/shared`, not Phaser scenes. The
**current** app still has working `src/gameplay`, `src/onboarding`, `src/speech`,
`src/api` and `src/session` folders; migrate incrementally during relevant tasks,
not in a separate sweeping refactor. Do not confuse React local practice state
with the server-owned ticket and rewards.

**Server: NestJS domain modules.** Build only modules required by the current
task, each with its own controller/service/repository **as needed**:

```text
apps/server/src/
  modules/
    auth/                 # Supabase JWT guard / current user (exists)
    onboarding/           # onboarding choices (exists)
    players/              # profile/character (exists)
    dialogue/             # cached scripted node lookup + intent (implemented)
    conversations/        # scripted session + append-only messages (implemented)
    quests/               # ordered arrival steps + bus-ticket entitlement (implemented)
    economy/              # transactional one-time quest rewards (implemented)
    learning/             # saved corrections and useful shop phrase review (implemented)
  infrastructure/         # database, content cache, external adapters
  common/                 # truly cross-cutting filters/pipes/guards
```

Modules expose **public services**, not another module's tables or repository.
Controllers handle HTTP/auth/schema validation; services own domain behavior;
repositories own persistence when queries merit a separate class. No massive
`GameService`, premature shared abstractions, blanket CQRS, or circular module
imports. `conversations` orchestrates dialogue and asks `quests` to apply
recognized intents; `quests` performs step/ticket changes and calls `economy`
for one-time rewards **inside the same PostgreSQL transaction**. A unique
reward/claim key protects retries/concurrency. Auth stays Supabase-first;
  external AI is isolated behind the server-only `AiProvider` interface.

**AI foundation (T10a):** `modules/ai` exports `AiService.reply(context, text)`
and accepts a text-only provider through dependency injection. `AI_PROVIDER`
defaults to `mock`; `gemini` selects the REST adapter using server-only
`AI_API_KEY` and `AI_MODEL` (both required); unsupported values fail startup.
Prompts live in `modules/ai/prompts.ts`. Replies time out after five
seconds and abort the provider request; errors (including 429), timeouts and
empty output return the authored `global_repeat` line. The module has no gameplay
write dependencies. Unrecognized Town Street resident small talk uses the selected
provider; recognized scripts, shop assistants, sellers and the receptionist keep
their scripted behavior. AI text is saved/replayed as dialogue and never interpreted
as gameplay commands. No conversation history or account identity goes to Gemini.
Use free Gemini keys with fictional development data only. Streaming/limits are T10c.

`packages/shared` contains only contracts, Zod schemas and pure rules actually
consumed across client/server. Authored quest/NPC/dialogue content stays in
`content/`; don't hide it in TypeScript components or controllers.

## Trust and data boundaries
- Client-only Sound/Coach preferences live under `life-abroad.preferences` in
  device `localStorage` (`src/features/hud`). Invalid/blocked storage falls back
  to defaults/in-memory state; no account data or tokens are stored with them.
- Browser calls **Supabase SDK only for authentication** (`apps/game/src/api/supabase-auth.ts`).
  Tokens and expiry persist in `localStorage` for PWA reopen; one-time
  `sessionStorage` migration; both stores clear on sign-out. Never place
  privileged keys in `VITE_*` settings.
- All **remote game-data reads/writes** go through NestJS
  (`apps/game/src/api/client.ts`) with the Supabase access token; no client
  database/PostgREST, server-only AI and authoritative progress.
- NestJS verifies JWT identity, validates requests with Zod, and uses a shared
  PostgreSQL pool. Future quest/reward writes must be transactional and idempotent.
- Server dialogue: shared global/role scripts load from validated `content/dialogue`
  JSON; only NPC-specific scripts seed into `dialogue_nodes`. Both sources are
  cached together with NPC → role → global lookup through `DialogueService.reply`.
  Deployments must include the content JSON alongside the server. Server callers
  supply NPC/role/personality and optionally the current node; replies include
  the matched intent, authored node and personality wording. Unrecognized input
  uses authored clarification without completing a step. Quest `doneWhen`
  supports a primary `intent` and optional `alternativeIntents`. The **server arrival quest**
  starts at the station receptionist: dialogue earns a bus-ticket entitlement,
  which permits entering Town Street; reward completion and saved progress are
  server-owned. Existing local station practice still uses ID-card directions,
  is separate/offline and gives no persistent ticket or rewards.
- The production PWA precaches **public** shell, audio, sprites and practice
  only. API/Auth/private data are network-only; no queued writes or fake
  offline success. Updates require explicit approval to reload; failed updates
  retain the active worker. Test on real devices before claiming PWA parity.
- Never modify an applied migration. Existing SQL files are `001` core,
  `002` unassigned player state, `003` player permissions, `004` dialogue nodes,
  `005` arrival ticket timestamps, character location and unique reward claims;
  `006` conversation node, immutable message replay metadata and ordering;
  `007` asset metadata and the public `game-assets` bucket; `008` wallet ledger;
  `009` shop catalog; `010` saved life, wardrobe and action receipts;
  `011` server-owned pending seller orders.
  Inspect schema and current database before applying new changes.

## API (implemented vs planned)
All paths are under `/api/v1`; protected requests use
`Authorization: Bearer <Supabase access token>`. Error envelope:
`{ "error": { "code": "...", "message": "..." } }`.

API throttling (T6) is opt-in: set both `API_RATE_LIMIT_MAX` and
`API_RATE_LIMIT_WINDOW_MS` to approved positive integers (window ≤ 2147483647ms).
No default request cap or AI free-chat policy is imposed. All routed calls,
including health and failed authentication, share a fixed window per connection
IP; excess calls return 429 `too_many_requests` with `Retry-After` seconds.
The global guard runs before controller authentication. Forwarded headers and
unverified tokens cannot select a different bucket. Expired buckets are removed.
Counters are process-local and reset on restart; multiple replicas need a shared
limiter before deployment, and a reverse proxy shares its peer-IP bucket.

**Implemented:**
- `POST /content/assets/upload` (service-key only): multipart `file`, `mapId?`,
  `npcId?`, `type`, positive integer `version` → `{ path, url, bytes }`. Send
  `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` from server tooling only.
  One file ≤20 MiB; filename stem supplies its logical key. Types: `map`, `image`,
  `audio`, `spritesheet`, `json`, `animation`. Station ownership is rejected.
  Version + SHA-256 filenames are immutable, cached for one year; identical
  retries reuse metadata, changed bytes/type require a new version.
- `GET /content/maps/:mapId` (public): `{ mapId, assets: [{ key, type, version,
  url, bytes, npcId }] }`. Latest version per map/NPC logical key, resolved from
  PostgreSQL; no browser PostgREST access. Unavailable packs return 404.
- `GET /health` → `{ status: "ok" }` (public).
- `GET /onboarding/options` → `{ cities, avatars }` (protected, authored content).
- `GET /me` → `{ user, character, stats }`; `character: null` before creation,
  `stats` contains existing `xp`/`coins` even before a character exists.
- `POST /characters` with `{ name, cityId, avatarId }`; creates one character
  atomically, adds the configured starting grant, duplicate returns 409.
- `GET /quests/arrival` → `{ questId, status, currentStepId, ticket: { issued,
  used }, canEnterTownStreet, locationId, rewardsGranted }` (protected; requires
  a character). Reads persisted account state; no client-provided user ID.
- `POST /quests/arrival/enter-town-street` with `{}` (protected): requires the
  ordered arrival steps and a server-issued ticket; returns arrival state.
  Ticket use, character location, completion, reward claim and XP/coins update
  commit atomically. Repeated exits return the saved result without another grant.
- `POST /conversations` with `{ npcId: "npc_receptionist" }`: creates a scripted
  station conversation with an authored opening message; requires a character
  at the station. Returns `{ id, npcId, messages, arrival }`.
- T17: `{ npcId: "npc_mia" }` creates a café seller conversation using the same
  routes. Responses additionally include `seller: { shop, pendingOrder, closed }`.
  One catalog item, quantity 1–3, is quoted from database prices and saved in the
  conversation. Players ask for the menu/prices, order, change, cancel and confirm
  through text; generic "coffee" requests ask for a specific catalog drink.
  Confirmation after a quoted order atomically charges the wallet, consumes the
  purchased items, restores energy (20 per drink or 50 per food, capped at 100),
  clears the order and appends both messages. Price changes require a new order;
  insufficient funds keep the unpaid order. Goodbye clears it and closes the
  conversation. Historical message replay remains available after closing.
  Store hours and per-message energy costs apply. T18 café progress is owned by
  the quests module; its completion/reward and drink payment share this transaction.
  Clothes purchase conversations remain T20. Shop maps use the uploaded
  `shop-walk` atlas; dialogue portraits use the static `shop-npcs` sheet.
- `GET /quests/coffee` (protected) returns `coffeeQuestStateSchema`: saved
  status/current objective, arrival eligibility and authored rewards. Cashier
  and waiter conversation responses also include `coffeeQuest`; no client
  endpoint writes quest intents or grants rewards. Payment refreshes the
  profile in the background to update XP without closing the dialogue.
- `GET /conversations/:id`: returns the owner's ordered messages and current
  arrival state. Another owner's ID returns 404; all routes require Auth.
- `POST /conversations/:id/messages` with `{ clientMessageId: <UUID>, text,
  coach?: boolean }`: trimmed text of 1–2000 characters, Coach defaults off.
  Returns `{ playerMessage, npcMessage, intent, misunderstood, correction,
  arrival }`; messages contain `{ id, sender, text, createdAt }`. Grammar feedback
  is optional and never prevents recognized meaning from progressing. Greet
  before asking directions/requesting a ticket; only a ticket request issues it.
  Out-of-order requests return 409 without appending messages or changing state.
  Both messages, node state, quest steps and ticket commit in one transaction.
  Retry the same conversation/message UUID with the same text/Coach setting to
  receive the original response without duplicate messages; changed payloads
  return 409. Replay includes the original arrival snapshot; GET gives current
  state. After entering Town Street, history/replay remain readable but new
  station messages are rejected. No edit/delete message endpoints are exposed.

`QuestsService.applyReceptionistIntent` and `issueArrivalTicket` are server-only
entry points for T7 orchestration; no public endpoint accepts dialogue intents,
step IDs or ticket grants. Steps are greet → directions/request → issue ticket
→ enter street. Character-row locking serializes concurrent account requests;
the `(user_id, quest_id)` reward ledger prevents duplicate grants. Null character
location means the station for existing starter-city characters. Existing
characters' balances remain intact; rewards come from the validated seeded quest.

**Economy (T15):** new character creation grants `STARTING_BALANCE` (server-only,
default **500**, whole dollars) atomically; existing characters receive no top-up.
The database field remains `coins`; the UI shows `$`. `wallet_ledger` records
signed amounts, reason, reference, account-scoped idempotency key and timestamp
for new grants/rewards/spends; it does not backfill historical balances.
`EconomyService.spend(userId, amount, reason, key, reference?)` is server-only:
positive integer charges lock the balance row in a transaction, reject insufficient
funds with 409, and replay matching keys without charging again. Reusing a key for
a different charge returns 409. `spendInTransaction` lets life purchases charge inside their effect transaction.

**Learning review (T12):** protected `GET /learning/review` returns deduplicated
useful shop phrases with saved examples and up to 20 recent Coach corrections.
It reads the latest 100 relevant conversation turns through the conversations
service; no separate vocabulary storage or migration is needed. The paused game
menu opens **English review**; private review data stays network-only.

**Planned (not callable yet):** other quest endpoints; vocabulary journal;
AI chat via SSE. Don't add `/auth/*` to NestJS; Supabase SDK owns auth.

**Shop catalog (T16):** `content/seed/shops.json` is a Zod-validated
array of `{ id, name, kind, price, shop, color?, image? }`; kind is `drink`, `food` or `clothing`,
shop is `cafe` or `clothes`, and prices are positive whole dollars. The catalog
contains 5 drinks, 5 pastries/snacks and 4 colored shirts at owner-approved prices. `db:seed` upserts
items by ID into `shop_items`. `ShopsService.listItems(shop)` reads that table
for server callers; the authenticated life catalog exposes these rows without browser database access. Validation rejects missing prices, unknown shops and duplicate IDs.
Optional images use approved local `/images/shops/` asset paths. Mia offers the
café menu in conversation; its catalog cards and illustrated placeholders appear
 after the player asks to see it or accepts her offer. Cards group drinks and
 food in separate sections, and Mia points to them instead of repeating the list
in dialogue. The player's last three saved café orders appear when they ask
about past orders.
Corner Cup Café on Town Street reuses the catalog and payment flow with its own
seller conversation and map pack. Its assistant and customers use the existing
shop companion scripts; the first coffee quest remains attached to Mia.

## Saved life and direct purchases

- Protected `GET /life` returns `{ energy, coins, gameTime, serverTime, clockRate, appearance, ownedShirts }`.
  State initializes lazily for a character at 100 energy and 08:00 on game day 2000-01-01.
  Its game clock advances at the configured rate (2× by default), including time
  away from the app. The server persists game time, real-time anchor and rate;
  changing the configured rate rebases the clock without a jump. Browser
  wall-clock changes cannot mutate saved time.
- Protected `GET /life/catalog` returns the seeded shop catalog.
- Protected `GET /life/orders` returns the latest ten café orders for the signed-in player. Each order stores item names, quantities and unit prices as purchased, its total and timestamp.
- `POST /life/sleep` takes `{ key: UUID }`, adds eight game hours immediately and restores 100 energy.
- `POST /life/purchase` takes `{ key: UUID, itemIds: string[] }`: one item or one drink plus
  one food. Stores accept purchases only from 08:00 until 20:00. Prices come from PostgreSQL.
  Payment, café order history and consumption/wardrobe changes share a transaction. Clothes purchases are not included in café order history. Consumables create no inventory;
  shirts enter `owned_shirts` and equip immediately.
- `POST /life/appearance` takes `{ key: UUID, hair?, trousers?, shirtItemId? }`.
  Hair/trousers change freely; equipped shirts must already be owned. Skin stays unchanged.
- Life writes serialize on the character/stats rows. `player_actions` stores matching replay
  receipts; a reused key with different arguments returns 409. Exact retries remain valid
  after closing time. Tables deny direct `anon`/`authenticated` access.
- Each new server conversation message consumes one energy point in the same transaction;
  replay consumes none. Zero energy returns 409 with sleep/food guidance. Local practice is free.
- React's game menu provides purchases, sleep and appearance; the HUD reads saved energy/time.
  Offline writes are disabled, and uncertain writes offer the same replay key for retry.
  Scene-owned derived textures preserve original animation frames and skin, and are released
  on transitions/teardown. The portrait remains the original artwork.

## Destination assets (T14 experiment)

Station art/voices remain bundled for first load and offline `/practice`.
Practice portals stay in the station. Signed-in destinations load public packs
on entry with progress, retry and an offline explanation; scene shutdown removes
previous textures, sounds/audio, JSON and animation keys. Storage URLs are never
included in PWA precache. The old destination PNG sources are retained as reference
art, but are no longer imported or built into the app.

Generated map files are kept outside the game bundle and Git in the ignored
`local-assets/maps/<mapId>/` directory. Recreate all three local packs without
Docker or Supabase using `pnpm assets:generate`; pass map IDs to limit output,
for example `pnpm assets:generate loc_cafe`. After local Supabase, migrations,
seed and NestJS are running, use
`pnpm run assets:upload -- --target local loc_town_street 1` (also `loc_cafe`,
`loc_clothes`). `SUPABASE_SERVICE_ROLE_KEY` comes from ignored local server
configuration; `CONTENT_API_URL` optionally overrides
`http://127.0.0.1:3000/api/v1` and must remain on localhost for the local target.
For an intentional production upload, run
`pnpm run assets:upload -- --target production loc_town_street 1` with
`PRODUCTION_CONTENT_API_URL` and `PRODUCTION_SUPABASE_SERVICE_ROLE_KEY` supplied
by the deployment environment. The URL must be HTTPS and non-local; the API must
be configured for that same production Supabase project. Production values are
never loaded from local `.env` files, and the service key remains server-side.
The upload script generates experimental SVG backgrounds, 32×48 player frames
and JSON walking definitions in `local-assets/maps/<mapId>/`, then uploads each
through NestJS. The ignored local copies remain available to inspect, back up or
upload again. Failed uploads leave the files in place for retry.
Original map artwork and station NPC atlases, portraits, and Kokoro-generated voice
clips can be copied from `apps/game/assets` into map-organized ignored folders
with `pnpm assets:archive`. Station voice clips are grouped under each matching
NPC by the scripted dialogue text; shared lines are copied to each NPC that uses
them. Tutorial narration is kept separately. This includes `loc_station` and
the current tax-office art.
The archive command preserves the source files because the station is still
bundled into the game and loaded directly by `/practice`.
Destination packs require a map background, `player` spritesheet and an animation
JSON asset defining `walk-0` through `walk-3`; definitions contain `key`, `texture`,
numeric `frames`, `frameRate` and `repeat`. Optional NPC art/voices and JSON are
loaded with the same pack; shop conversations remain separate later tasks.

Town Street dialogue uses Kokoro recordings (`af_heart` / `am_michael`, speed
0.95), matching the station's generator. `pnpm voices:street -- --upload`
generates the authored role/global lines in `local-assets/maps/loc_town_street/audio`
and registers audio plus `street-voices.json` through the existing local asset
API. `pnpm voices:street:check` decodes every clip and checks silence/clipping.
The client resolves text/gender through that manifest and streams only the
requested MP3; these files are excluded from Phaser's eager pack download and
the station PWA precache. Failed NPC recordings show a retry message instead of
silently switching to a browser voice. Station recordings remain unchanged.

Measured 2026-10-10: initial built asset payload **15,047,847 → 7,121,361 bytes**
(14.35 → 6.79 MiB; uncompressed bytes, not network timing). Public precache:
6.81 MiB. Town Street/café/clothes packs: **6,202 / 6,191 / 6,193 bytes**.
`/tests/map-pack-browser.html` on Vite verifies ten real station/street round trips:
texture allocation remains **6,408,800 bytes**, with stable texture/cache/animation,
scene-object and listener counts. This proves bounded Phaser resources; it is not
a garbage-collection-controlled JavaScript heap profile. Physical phones remain
unverified.

## Run locally
Local Supabase uses project `english-life-game`: API/Auth/Storage on
`127.0.0.1:54321`, PostgreSQL on `127.0.0.1:54322`. The previous
`life-abroad-local` data and 30 stored asset objects were restored into this
instance with verified file hashes; recovery copies remain in ignored
`local-assets/database-transfer/`. Keep the old volumes until recovery copies
are no longer needed.

Install Node >=20.19, pnpm 11 and Docker (only needed for local Supabase):

```sh
pnpm install
pnpm supabase:start             # local Auth/API, Postgres and Studio (Docker)
pnpm supabase:env               # generates ignored server-local environment
pnpm db:migrate                # forward migrations only
pnpm db:seed                   # idempotent authored JSON seed
pnpm dev                       # Vite :8082 + NestJS :3000
```

Set root `.env` using `.env.example` (server-only settings); set
`apps/game/.env.local` using `apps/game/.env.example` with **public**
`VITE_API_URL`, `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
`supabase:env` creates `apps/server/.env.supabase.local`; copy only public
Supabase settings into the game local env. These files are ignored by Git and
**excluded from shared ZIP packages**. For a phone browser, configure reachable
HTTPS client/API/Auth origins and correct CORS; `localhost` on the phone refers
to the phone, not the computer.

- `pnpm dev:game`, `pnpm dev:web`, `pnpm dev:server`: targeted dev servers.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm content:validate`,
  `pnpm build`: project validation/build.
- `pnpm test:integration`: real local Supabase/Postgres tests; requires setup.
  The rollback-only T10b test reuses `test@gmail.com`: from `apps/server`, set
  `T10_TEST_PASSWORD`, build, then run
  `node --import ./scripts/load-env.mjs --test dist/tests/ai.integration.test.js`.
  It uses the mock by default; set `T10_LIVE_TEST=true` to require a real Gemini
  reply with the configured key/model. Neither mode starts an HTTP server.
  The T17 seller test reuses an existing account (`T17_TEST_EMAIL`, default
  `test@gmail.com`; required `T17_TEST_PASSWORD`) and rolls back all game-data
  changes. To run only it without older tests that create temporary accounts,
  build the server, then run from `apps/server`:
  `node --import ./scripts/load-env.mjs --test dist/tests/seller.integration.test.js`.
- `pnpm preview:game`: preview **production** PWA on :8082 (stop `pnpm dev`
  first; they share a port). `pnpm check:pwa`: validates built worker/manifest;
  run **after** building.
- `pnpm supabase:status|supabase:stop`, `pnpm voices:build`: optional commands
  for local infrastructure / existing station recordings.

The app's unauthenticated `/practice` route runs locally and gives no progress.
Production deployment needs HTTPS, SPA route fallback, correct CORS, and
cache/revalidation headers. No deployment is included in this repository.
Physical Android/iOS install, standalone reopen and airplane-mode testing are
**unverified**, even though desktop/browser offline practice was tested.

## Future decisions, not current implementation
Café seller conversations enforce store hours. Organization visits and work
actions remain future tasks; their approved opening hours are shared contracts.
AI provider/limits, CEFR promotion and full speech service remain future decisions.
See `TASKS.md` before extending scope.
