# TECH — current architecture and setup

## Current stack (D16, 2026-10-09)
| Area | Implementation |
| --- | --- |
| Client | `apps/game`: Vite 8, React DOM 19, strict TypeScript, Phaser 4, installable browser PWA |
| Server | `apps/server`: NestJS 11, API and server-authoritative gameplay |
| Data/auth | PostgreSQL and Supabase Auth; public Storage for versioned destination packs |
| Shared | `packages/shared`: game logic, Zod schemas and API contracts |
| Content | `content/seed` and `content/dialogue`: validated JSON, then seeded to Postgres |
| Tooling | pnpm workspace, Node >=20.19; Docker for local Supabase |

**No Expo, React Native, WebView, native build or second client.** Redis is
optional later, not a required development service today.

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
    learning/             # optional corrections/feedback (planned)
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
  external AI stays a future server-only adapter, not a mandatory module.

`packages/shared` contains only contracts, Zod schemas and pure rules actually
consumed across client/server. Authored quest/NPC/dialogue content stays in
`content/`; don't hide it in TypeScript components or controllers.

## Trust and data boundaries
- Browser calls **Supabase SDK only for authentication** (`apps/game/src/api/supabase-auth.ts`).
  Tokens and expiry persist in `localStorage` for PWA reopen; one-time
  `sessionStorage` migration; both stores clear on sign-out. Never place
  privileged keys in `VITE_*` settings.
- All **remote game-data reads/writes** go through NestJS
  (`apps/game/src/api/client.ts`) with the Supabase access token; no client
  database/PostgREST, server-only AI and authoritative progress.
- NestJS verifies JWT identity, validates requests with Zod, and uses a shared
  PostgreSQL pool. Future quest/reward writes must be transactional and idempotent.
- Server dialogue: JSON → validation → seed into `dialogue_nodes` → cached
  NPC/role/global lookup through `DialogueService.reply` (T4). Server callers
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
  `007` asset metadata and the public `game-assets` bucket.
  Inspect schema and current database before applying new changes.

## API (implemented vs planned)
All paths are under `/api/v1`; protected requests use
`Authorization: Bearer <Supabase access token>`. Error envelope:
`{ "error": { "code": "...", "message": "..." } }`.

API throttling (T6) is opt-in: set both `API_RATE_LIMIT_MAX` and
`API_RATE_LIMIT_WINDOW_MS` to approved positive integers (window ≤ 2147483647ms).
No default request cap or energy/free-chat policy is imposed. All routed calls,
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
  atomically, retains existing stats, duplicate returns 409.
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
balances remain intact; rewards come from the validated seeded quest.

**Planned (not callable yet):** other quest endpoints; corrections history/
vocabulary; AI chat via SSE. Don't add `/auth/*` to NestJS; Supabase SDK owns auth.

## Destination assets (T14 experiment)

Station art/voices remain bundled for first load and offline `/practice`.
Practice portals stay in the station. Signed-in destinations load public packs
on entry with progress, retry and an offline explanation; scene shutdown removes
previous textures, sounds/audio, JSON and animation keys. Storage URLs are never
included in PWA precache. The old destination PNG sources are retained as reference
art, but are no longer imported or built into the app.

After local Supabase, migrations, seed and NestJS are running, use
`pnpm assets:upload loc_town_street 1` (also `loc_cafe`, `loc_clothes`).
`SUPABASE_SERVICE_ROLE_KEY` comes from ignored server configuration;
`CONTENT_API_URL` optionally overrides `http://127.0.0.1:3000/api/v1`.
The script generates experimental SVG backgrounds, 32×48 player frames and JSON
walking definitions in a temporary directory, uploads each through NestJS, then
deletes confirmed uploads. Failed uploads retain their generated file for retry.
Destination packs require a map background, `player` spritesheet and an animation
JSON asset defining `walk-0` through `walk-3`; definitions contain `key`, `texture`,
numeric `frames`, `frameRate` and `repeat`. Optional NPC art/voices and JSON are
loaded with the same pack; shop conversations remain separate later tasks.

Measured 2026-10-10: initial built asset payload **15,047,847 → 7,121,361 bytes**
(14.35 → 6.79 MiB; uncompressed bytes, not network timing). Public precache:
6.81 MiB. Town Street/café/clothes packs: **6,202 / 6,191 / 6,193 bytes**.
`/tests/map-pack-browser.html` on Vite verifies ten real station/street round trips:
texture allocation remains **6,408,800 bytes**, with stable texture/cache/animation,
scene-object and listener counts. This proves bounded Phaser resources; it is not
a garbage-collection-controlled JavaScript heap profile. Physical phones remain
unverified.

## Run locally
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
AI provider/limits, energy, CEFR
promotion and full speech service are not authorized by these architecture
notes. See `TASKS.md` before extending scope.
