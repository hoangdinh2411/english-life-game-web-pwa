# TECH — current architecture and setup

## Current stack (D16, 2026-10-09)
| Area | Implementation |
| --- | --- |
| Client | `apps/game`: Vite 8, React DOM 19, strict TypeScript, Phaser 4, installable browser PWA |
| Server | `apps/server`: NestJS 11, API and server-authoritative gameplay |
| Data/auth | PostgreSQL and Supabase Auth; Storage available for future public assets |
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
    dialogue/             # scripted node lookup + intent (planned)
    conversations/        # session + append-only messages (planned)
    quests/               # ordered quest steps + bus-ticket state (planned)
    economy/              # transactional XP/coins rewards (planned)
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
  NPC/role/global lookup (engine **planned**). The **first planned server quest**
  starts at the station receptionist: dialogue earns a bus-ticket entitlement,
  which permits entering Town Street; reward completion and saved progress are
  server-owned. Existing local station practice still uses ID-card directions,
  is separate/offline and gives no persistent ticket or rewards.
- The production PWA precaches **public** shell, audio, sprites and practice
  only. API/Auth/private data are network-only; no queued writes or fake
  offline success. Updates require explicit approval to reload; failed updates
  retain the active worker. Test on real devices before claiming PWA parity.
- Never modify an applied migration. Existing SQL files are `001` core,
  `002` unassigned player state, `003` player permissions, `004` dialogue nodes.
  Inspect schema and current database before applying new changes.

## API (implemented vs planned)
All paths are under `/api/v1`; protected requests use
`Authorization: Bearer <Supabase access token>`. Error envelope:
`{ "error": { "code": "...", "message": "..." } }`.

**Implemented:**
- `GET /health` → `{ status: "ok" }` (public).
- `GET /onboarding/options` → `{ cities, avatars }` (protected, authored content).
- `GET /me` → `{ user, character, stats }`; `character: null` before creation,
  `stats` contains existing `xp`/`coins` even before a character exists.
- `POST /characters` with `{ name, cityId, avatarId }`; creates one character
  atomically, retains existing stats, duplicate returns 409.

**Planned (not callable yet):** quest endpoints; scripted conversation
create/send-message; corrections/vocabulary; AI chat via SSE; public asset
manifest. Don't add `/auth/*` to NestJS; Supabase SDK owns auth.

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
Supabase Storage manifest/download caching, AI provider/limits, energy, CEFR
promotion and full speech service are not authorized by these architecture
notes. See `TASKS.md` before extending scope.
