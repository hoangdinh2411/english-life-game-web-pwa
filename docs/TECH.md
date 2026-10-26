# TECH — current architecture and setup

## Current stack (D16, 2026-10-11)

| Area       | Implementation                                                                                                         |
| ---------- | ---------------------------------------------------------------------------------------------------------------------- |
| Client     | `apps/game`: Vite 8, React DOM 19, strict TypeScript, Phaser 4, installable browser PWA                                |
| UI styling | Tailwind CSS 4.3 through the official `@tailwindcss/vite` plugin; component-local utilities                            |
| Server     | `apps/server`: NestJS 11, API and server-authoritative gameplay                                                        |
| Data/auth  | PostgreSQL and Supabase Auth; public Storage for versioned destination packs                                           |
| Shared     | `packages/shared`: game logic, Zod schemas and API contracts                                                           |
| Content    | Validated JSON: catalogs and NPC-specific dialogue seed to Postgres; shared global/role scripts load from server files |
| Tooling    | pnpm workspace, Node >=22.13; Docker for local Supabase                                                                |

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
  component layout, responsive rules and states in JSX rather than adding named
  CSS selectors. Existing semantic class markers support state/descendant
  variants and UI inspection; their visual styles are Tailwind utilities.
- UI colors are semantic tokens, not component literals. React/Tailwind code
  must use named theme utilities or `var(--color-...)`; do not add hex/rgb
  values directly to JSX class names. Phaser, canvas, and PWA configuration must
  use `apps/game/src/styles/colors.ts`. When a new visual role is needed, add
  the role to both token maps and reuse it; keep raw color values confined to
  those definitions unless an external format requires them.
- Preflight is deliberately omitted to preserve existing browser form defaults.
  The theme and utilities are imported separately; existing global defaults use
  `@layer base` and `@apply`. Preserve 44px controls, focus outlines, safe-area
  offsets, existing mobile breakpoints and reduced-motion behavior.
- `pnpm dev:game` compiles utilities during development. Verify styling changes
  with `pnpm --filter game test`, `pnpm typecheck`, `pnpm lint`,
  `pnpm --filter game build` and `pnpm check:pwa`, plus responsive browser
  checks at 320/375px and tablet/desktop widths. Generated CSS remains a public
  PWA asset. `/tests/ui-styles-browser.html` is a development-only fixture for
  the real onboarding/dialogue components and their selected, disabled, error
  and focus states; it uses fictional data and never calls Auth or gameplay
  APIs.

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

These are **placement examples, not folders to pre-create**. A small feature can
be a single file. Co-locate related components/hooks/tests; split when a file
mixes responsibilities or becomes difficult to navigate, not to meet a
line-count rule. Keep the dependency direction `app → features → shared`;
features should not reach into another feature's private internals. Game rules
shared with the server belong in `packages/shared`, not Phaser scenes. The
**current** app still has working `src/gameplay`, `src/onboarding`,
`src/speech`, `src/api` and `src/session` folders; migrate incrementally during
relevant tasks, not in a separate sweeping refactor. Do not confuse React local
practice state with the server-owned ticket and rewards.

### Code ownership rules

Apply these rules to every changed file. They are ownership rules, not quotas:

- A file has one primary responsibility. Split it when it coordinates unrelated
  features, mixes rendering with substantial state/effects, or makes unrelated
  dependencies change together. File length alone is not a reason to split.
- React components render and compose UI. Keep short, component-specific state
  locally; extract a custom hook when state, effects and event workflows form a
  behavior that can be named and tested independently. Do not extract hooks only
  to remove `useState` or `useEffect` from a component.
- Co-locate feature UI, hooks, models, API adapters and Phaser code under the
  owning `features/<feature>/` directory. Use `components/`, `hooks/`, `model/`,
  `api/` or `game/` only after the feature needs that extra level. `.ts` and
  `.tsx` files may live together; JSX usage determines the extension.
- Keep imports flowing `app → features → shared`. A feature may use another
  feature's explicit public contract, but must not import its private component,
  hook or repository internals. Move genuinely reused UI or behavior to
  `shared/` only after a second real consumer exists.
- Keep React-to-Phaser adapters narrow. React owns DOM UI and lifecycle; Phaser
  owns world rendering and input. Quest, economy and progression decisions must
  not be embedded in scenes.
- On the server, controllers translate validated HTTP input/output, services own
  domain decisions and orchestration, and repositories own SQL. Split a service
  when it accumulates independent decision pipelines or depends on many domains;
  preserve transactions and call other domains through exported services.
- Refactor one ownership boundary at a time. Preserve public interfaces and add
  or run focused characterization tests before relying on a structural move. Do
  not combine a behavior change with a structural refactor unless the task
  explicitly requires both.

### Adding a venue's NPC roster

NPC walking artwork follows one source contract for every map: a 4×4 RGBA PNG
sheet, one direction per row and four walk frames per row. Each frame is 128×192
px, with the visible character normalized to 156 px high, horizontally centered,
and standing on the shared bottom baseline. Preserve aspect ratio and use one
transform for every frame in a directional row; never resize individual walk
frames to simulate motion. Run `pnpm assets:normalize-npcs` on legacy 96×171
sheets before adding them. Runtime code uses the single `NPC_DISPLAY_SCALE`; do
not add NPC-ID scale exceptions. Generate props against an equivalent declared
frame, visual box, center, and ground-contact baseline before they enter a map
pack so maps never compensate for asset padding.

`apps/game/src/features/npcs/controlled-presence.ts` owns the shared time
buckets, validated venue contract and seeded ambient selection. Its seed uses
the selected country's local game date and time bucket; missing or invalid time
data deterministically falls back to `2000-01-01` in the daytime bucket.
Venue-specific service staff, ambient pools, limits and safe spawn/exclusion
geometry live in `apps/game/src/features/shops/venue-npc-config.ts`. To add a
store, add its NPC content and portrait/walking assets, add its display identity
to `features/shops/shop-npcs.ts`, and bundle required service textures through
`features/shops/service-npc-assets.ts`. Then add one validated venue
configuration and walkable customer-only spawn and exclusion zones; keep exits,
counters and primary paths clear. The registry owns selection, so a venue does
not need its own selector. Verify the new roster with focused game tests,
`pnpm content:validate`, `pnpm --filter game build` and `pnpm check:pwa`. Store
opening hours remain in `features/shops/shop-navigation.ts`.

Required store staff use bundled atlases from
`features/shops/service-npc-assets.ts`; generated map packs retain actor
placement but omit those staff images. Customers may remain map-pack assets.
Town Street continues to use server-authored weekly presence schedules rather
than controlled randomness.

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

**AI foundation (T10a–T10g):** `modules/ai` exports
`AiService.reply(context, text, prompt?)` and accepts a text-only provider
through dependency injection. `AI_PROVIDER` defaults to `mock`; `gemini` selects
the REST adapter using server-only `AI_API_KEY` and `AI_MODEL` (both required);
unsupported values fail startup. Prompts live in `modules/ai/prompts.ts`.
Replies time out after twenty seconds and abort the provider request; errors
(including 429), timeouts and empty output return the authored `global_repeat`
line. `AI_ENABLED` defaults off; set it to `true` only for intentional
development tests. All supported NPCs check server scripts first. Pending
orders/active NPC quests stay scripted. Unmatched messages reach the provider
for every NPC, extending the available conversation topics after scripted
dialogue has had priority. AI text never becomes a gameplay intent.
`NpcPromptService.build` validates the strict authored NPC profile, then sends
only an explicit personal-fact allowlist, place/city/country, opening status,
effective mood, relationship stage and a bounded response level. The level
defaults to A2 without learner data; otherwise stored level and observable input
complexity may move it by at most one CEFR band for the current turn. The prompt
also includes at most the last six complete conversation turns. Account
identifiers, known player names and emails are removed from current input and
history. Schedule rules, mood rules and the player profile never reach the
provider. Store prompts answer service requests first and redirect unrelated
chat. When meaning is clear but phrasing is unnatural, the prompt asks the NPC
to weave the natural form into its reply once without announcing or explaining
the correction; harmless errors may be ignored. Mood and relationship may change
tone or length but never facts or game state; missing NPC facts must not be
invented. Free Gemini keys remain for fictional development data only.
Authenticated free chat uses Gemini's native stream through `POST /chat/stream`.
The server buffers one sentence, validates it, then forwards the safe sentence
immediately; complete accepted replies and usage are saved atomically, retries
replay without another charge, and disconnects roll back partial replies. One
stream per user is allowed. Optional positive `AI_DAILY_CHAT_LIMIT` and
`AI_DAILY_TOKEN_LIMIT` settings enforce daily limits through `ai_usage_daily`;
unset values impose no unapproved cap. The client uses the SSE endpoint for
saved NPC dialogue, aborts it when the panel closes, labels only
server-confirmed AI replies and resumes the authenticated conversation after
reload from an opaque per-NPC ID in session storage. Authenticated authored and
AI replies can include short-lived private speech URLs; the client keeps the
text visible and falls back when speech is unavailable. `VITE_AI_TEST_MODE=true`
shows the development-only AI disclosure. The AI safety boundary trims input and
rejects empty, over-300-character, non-English, emoji-spam, prompt-injection,
economy-manipulation, personal-data and medical requests before a provider call.
Generated replies must be plain English text of at most 40 words, without
Markdown, profanity, gameplay/economy claims, personal-data requests or medical
advice. Rejected input/output uses the authored `global_repeat` line; a later
rejected streamed sentence is discarded while already accepted complete
sentences remain the saved reply. Migration `016` provides server-only usage
storage used by streamed AI chat.

`packages/shared` contains only contracts, Zod schemas and pure rules actually
consumed across client/server. Authored quest/NPC/dialogue content stays in
`content/`; don't hide it in TypeScript components or controllers.

## Trust and data boundaries

- Sound mute/volume remains device-local under `life-abroad.sound`; the legacy
  `life-abroad.preferences` value is read only as a migration fallback.
  Signed-in coach, speech-rate and pitch preferences use the NestJS-owned
  `/players/preferences` contract and `player_preferences` table. Local practice
  keeps those controls in memory and never calls that account endpoint. Invalid
  or blocked storage falls back safely; no account data or tokens are stored
  with device sound settings.
- Browser calls **Supabase SDK only for authentication**
  (`apps/game/src/api/supabase-auth.ts`). Tokens and expiry persist in
  `localStorage` for PWA reopen; one-time `sessionStorage` migration; both
  stores clear on sign-out. Never place privileged keys in `VITE_*` settings.
- All **remote game-data reads/writes** go through NestJS
  (`apps/game/src/api/client.ts`) with the Supabase access token; no client
  database/PostgREST, server-only AI and authoritative progress.
- NestJS verifies JWT identity, validates requests with Zod, and uses a shared
  PostgreSQL pool. Future quest/reward writes must be transactional and
  idempotent.
- Server dialogue: shared global/role scripts load from validated
  `content/dialogue` JSON; only NPC-specific scripts seed into `dialogue_nodes`.
  Both sources are cached together with NPC → role → global lookup through
  `DialogueService.reply`. Deployments must include the content JSON alongside
  the server. Server callers supply NPC/role/personality and optionally the
  current node; replies include the matched intent, authored node and
  personality wording. Unrecognized input uses authored clarification without
  completing a step. Quest `doneWhen` supports a primary `intent` and optional
  `alternativeIntents`. The **server arrival quest** starts at the station
  receptionist: dialogue earns a bus-ticket entitlement, which permits entering
  Town Street; reward completion and saved progress are server-owned. Existing
  local station practice still uses ID-card directions, is separate/offline and
  gives no persistent ticket or rewards.
- The production PWA precaches **public** shell, audio, sprites and practice
  only. API/Auth/private data are network-only; no queued writes or fake offline
  success. Updates require explicit approval to reload; failed updates retain
  the active worker. Test on real devices before claiming PWA parity.
- Never modify an applied migration. Existing SQL files are `001` core, `002`
  unassigned player state, `003` player permissions, `004` dialogue nodes, `005`
  arrival ticket timestamps, character location and unique reward claims; `006`
  conversation node, immutable message replay metadata and ordering; `007` asset
  metadata and the public `game-assets` bucket; `008` wallet ledger; `009` shop
  catalog; `010` saved life, wardrobe and action receipts; `011` server-owned
  pending seller orders; `020` saved player map and exact place; `021` saved
  position within that place; `022` saved opening variation indices so
  unanswered NPC openings stay out of message history. Migrations `012`–`019`
  cover dialogue storage and AI/NPC assets; `025` adds server-only fixed-speech
  metadata and a private `speech-audio` bucket; `026` adds expiring AI-speech
  references without source text; `027` adds the country catalog, internal
  country-to-starter-city mapping and each character's country. Migration `028`
  adds the required versioned `npcs.profile` JSONB document; strict field
  validation happens before seeding and prompt construction. Migration `029`
  adds the editable mood catalog and persisted base mood; migration `030` adds
  private per-player relationships and idempotent social events. Migration `032`
  adds the canonical 247-country catalog and immutable shared country worlds;
  `033` removes obsolete per-player clock columns; `034` replaces legacy
  Sweden-specific presentation text while preserving country records. These are
  unique forward migrations; applied migrations remain immutable. Migration
  `035` adds the immutable, check-constrained character gender used to resolve
  approved player walking and portrait assets; existing rows are backfilled
  before the column becomes required. Canonical speech keys include only
  generation inputs, and callers receive 60-second signed URLs. AI audio uses
  `AI_SPEECH_CACHE_TTL_SECONDS` (30–3600, default 300) and rejects sensitive
  text. Inspect schema and current database before applying new changes.

## API (implemented vs planned)

All paths are under `/api/v1`; protected requests use
`Authorization: Bearer <Supabase access token>`. Error envelope:
`{ "error": { "code": "...", "message": "..." } }`.

API throttling (T6) is opt-in: set both `API_RATE_LIMIT_MAX` and
`API_RATE_LIMIT_WINDOW_MS` to approved positive integers (window ≤
2147483647ms). No default request cap or AI free-chat policy is imposed. All
routed calls, including health and failed authentication, share a fixed window
per connection IP; excess calls return 429 `too_many_requests` with
`Retry-After` seconds. The global guard runs before controller authentication.
Forwarded headers and unverified tokens cannot select a different bucket.
Expired buckets are removed. Counters are process-local and reset on restart;
multiple replicas need a shared limiter before deployment, and a reverse proxy
shares its peer-IP bucket.

**Implemented:**

- `POST /content/assets/upload` (service-key only): multipart `file`, `mapId?`,
  `npcId?`, `type`, positive integer `version` → `{ path, url, bytes }`. Send
  `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` from server tooling only.
  One file ≤20 MiB; filename stem supplies its logical key. Types: `map`,
  `image`, `audio`, `spritesheet`, `json`, `animation`. Station ownership is
  rejected. Version + SHA-256 filenames are immutable, cached for one year;
  identical retries reuse metadata, changed bytes/type require a new version.
- `GET /content/maps/:mapId` (public):
  `{ mapId, assets: [{ key, type, version, url, bytes, npcId }] }`. Latest
  version per map/NPC logical key, resolved from PostgreSQL; no browser
  PostgREST access. Unavailable packs return 404.
- `GET /health` → `{ status: "ok" }` (public).
- `GET /onboarding/options` → `{ countries }` (protected, database-backed
  content). Countries expose `id`, `name`, ISO code, flag and IANA time zone;
  their starter-city mapping remains server-only.
- `GET /me` → `{ user, character, stats }`; a created character includes
  authoritative `countryId`, `countryName` and immutable `gender` for
  country-aware presentation and approved player asset selection. It returns
  `character: null` before creation and for an incomplete legacy row without a
  valid country/starter city, causing the client to return to `/new-game`;
  `stats` retains existing `xp`/`coins` in either case.
- `POST /characters` with `{ name, countryId, gender }`; accepts only `female`
  or `male`, trims and NFC-normalizes a 2–20-character Unicode name, validates
  the database country, finds or creates its shared clock world, and atomically
  creates the character at the trusted starter location with the configured
  starting grant. An identical normalized replay, including gender, returns the
  saved profile; a different replay returns 409. The server stores
  `avatar_traveler_01` only as a temporary compatibility default.
- `POST /players/location` with `{ mapId, placeId, x, y }`; saves the
  authenticated character's outdoor parent map, exact playable place and bounded
  position. Only authored map/place pairs are accepted; this does not change
  quest progress or access. Movement checkpoints are written locally first and
  debounced for five seconds before this endpoint is called; place changes and
  backgrounding flush immediately.
- `GET /quests/arrival` →
  `{ questId, status, currentStepId, ticket: { issued, used }, canEnterTownStreet, locationId, rewardsGranted }`
  (protected; requires a character). Reads persisted account state; no
  client-provided user ID.
- `POST /quests/arrival/enter-town-street` with `{}` (protected): requires the
  ordered arrival steps and a server-issued ticket; returns arrival state.
  Ticket use, character location, completion, reward claim and XP/coins update
  commit atomically. Repeated exits return the saved result without another
  grant.
- `POST /conversations` with `{ npcId: "npc_receptionist" }`: creates a scripted
  station conversation and returns an authored opening message for display;
  requires a character at the station. The opening is only saved with the first
  player reply, so abandoned openings do not appear in message history. Returns
  `{ id, npcId, messages, arrival }`.
- T17: `{ npcId: "npc_mia" }` creates a café seller conversation using the same
  routes. Responses additionally include
  `seller: { shop, pendingOrder, closed }`. One catalog item, quantity 1–3, is
  quoted from database prices and saved in the conversation. Players ask for the
  menu/prices, order, change, cancel and confirm through text; generic "coffee"
  requests ask for a specific catalog drink. Confirmation after a quoted order
  atomically charges the wallet, consumes the purchased items, restores energy
  (20 per drink or 50 per food, capped at 100), clears the order and appends
  both messages. Price changes require a new order; insufficient funds keep the
  unpaid order. Goodbye clears it and closes the conversation. Historical
  message replay remains available after closing. Store hours and per-message
  energy costs apply. T18 café progress is owned by the quests module; its
  completion/reward and drink payment share this transaction. Clothes purchase
  conversations remain T20. Every NPC owns a separate 16-frame walk sheet and a
  three-expression portrait strip under `assets/npcs/<npc-id>/`; generated map
  packs upload those assets independently.
- `GET /quests/coffee` (protected) returns `coffeeQuestStateSchema`: saved
  status/current objective, arrival eligibility and authored rewards. Cashier
  and waiter conversation responses also include `coffeeQuest`; no client
  endpoint writes quest intents or grants rewards. Payment refreshes the profile
  in the background to update XP without closing the dialogue.
- `GET /conversations/:id`: returns the owner's ordered messages and current
  arrival state. Another owner's ID returns 404; all routes require Auth.
- `POST /conversations/:id/messages` with `{ clientMessageId: <UUID>, text }`:
  trimmed text of 1–2000 characters. Returns
  `{ playerMessage, npcMessage, intent, misunderstood, arrival }`; messages
  contain `{ id, sender, text, createdAt }`. Greet before asking
  directions/requesting a ticket; only a ticket request issues it. Out-of-order
  requests return 409 without appending messages or changing state. Both
  messages, node state, quest steps and ticket commit in one transaction. Retry
  the same conversation/message UUID with the same text to receive the original
  response without duplicate messages; changed payloads return 409. Replay
  includes the original arrival snapshot; GET gives current state. After
  entering Town Street, history/replay remain readable but new station messages
  are rejected. No edit/delete message endpoints are exposed.
- `POST /chat/stream` with `{ npcId, conversationId, clientMessageId, text }`
  (protected): emits SSE `token` events word by word, then `done`, or `error`.
  Only complete replies persist. AI messages carry `metadata.ai: true`;
  provider/model token estimates are recorded in `ai_usage` and daily totals.
  Exact retries replay the saved response without another energy or usage
  charge.

`QuestsService.applyReceptionistIntent` and `issueArrivalTicket` are server-only
entry points for T7 orchestration; no public endpoint accepts dialogue intents,
step IDs or ticket grants. Steps are greet → directions/request → issue ticket →
enter street. Character-row locking serializes concurrent account requests; the
`(user_id, quest_id)` reward ledger prevents duplicate grants. Null character
location means the station for existing starter-city characters. Existing
characters' balances remain intact; rewards come from the validated seeded
quest.

**Economy (T15):** new character creation grants `STARTING_BALANCE`
(server-only, default **500**, whole dollars) atomically; existing characters
receive no top-up. The database field remains `coins`; the UI shows `$`.
`wallet_ledger` records signed amounts, reason, reference, account-scoped
idempotency key and timestamp for new grants/rewards/spends; it does not
backfill historical balances.
`EconomyService.spend(userId, amount, reason, key, reference?)` is server-only:
positive integer charges lock the balance row in a transaction, reject
insufficient funds with 409, and replay matching keys without charging again.
Reusing a key for a different charge returns 409. `spendInTransaction` lets life
purchases charge inside their effect transaction.

**Planned (not callable yet):** other quest endpoints; player-curated saved-line
storage. Don't add `/auth/*` to NestJS; Supabase SDK owns auth.

**Shop catalog (T16):** `content/seed/shops.json` is a Zod-validated array of
`{ id, name, kind, price, shop, color?, image? }`; kind is `drink`, `food` or
`clothing`, shop is `cafe` or `clothes`, and prices are positive whole dollars.
The catalog contains 5 drinks, 5 pastries/snacks and 4 colored shirts at
owner-approved prices. `db:seed` upserts items by ID into `shop_items`.
`ShopsService.listItems(shop)` reads that table for server callers; the
authenticated life catalog exposes these rows without browser database access.
Validation rejects missing prices, unknown shops and duplicate IDs. Optional
images use approved local `/images/shops/` asset paths. Mia offers the café menu
in conversation; its catalog cards and illustrated placeholders appear after the
player asks to see it or accepts her offer. Cards group drinks and food in
separate sections, and Mia points to them instead of repeating the list in
dialogue. The player's last three saved café orders appear when they ask about
past orders. Corner Cup Café on Town Street reuses the catalog and payment flow
with its own seller conversation and map pack. Its assistant and customers use
the existing shop companion scripts; the first coffee quest remains attached to
Mia.

## Saved life and direct purchases

- Protected `GET /life` returns
  `{ energy, coins, gameTime, serverTime, clockRate, appearance, ownedShirts }`.
- Protected `GET /world-clock` joins the authenticated character to its shared
  country world and returns `{ gameTimeUtc, timeZone, clockRate }`. Server
  decisions convert that instant through the country IANA zone. The client
  interpolates display time from `performance.now()` and resynchronizes on load,
  reconnect, visible-tab return and every 60 seconds; HUD, venue checks and NPC
  refreshes share that snapshot. Life state initializes lazily at 100 energy and
  retains only appearance in `player_life`; action receipts remain in
  `player_actions`. Per-player clock columns were removed by forward migration
  `033_remove_per_player_clock.sql`. Every runtime time decision reads the
  character's selected-country world, whose start and 6× rate are immutable.
  Browser wall-clock changes cannot mutate saved time.
- `mood_types` stores editable mood labels and dialogue guidance. NPC base mood
  references this catalog, defaults to `neutral`, and is recomputed on dialogue
  context reads from server-owned game time converted through the selected
  country's IANA zone. The resolver updates changed base moods lazily; no cron
  job or client clock participates.
- Protected `GET /npcs/presence?mapId=<location-id>` returns the server-derived
  NPC allowlist plus `gameTime`, the selected country IANA `timeZone`, and the
  next game-time boundary. Phaser refreshes on map entry, reconnect and that
  boundary, hiding absent actors. `POST /conversations` rejects absent NPCs;
  message requests for an existing conversation do not repeat the presence
  check.
- `npc_relationships` stores private per-player/NPC familiarity, affinity and
  temporary reaction mood. Relationship stages are derived server-side. Explicit
  social signals update this row inside the conversation-turn transaction; a
  locked row and `npc_relationship_events` keyed by the existing client message
  UUID provide concurrency safety, daily caps and replay idempotency.
- Dialogue context loads the NPC's strict profile plus the authenticated
  character's selected country and its trusted starter city, alongside the NPC
  place name, from PostgreSQL. Scripted rendering and AI prompt context share
  that selected-country authority; they never infer country from an NPC's
  generic location. The renderer substitutes only an explicit token allowlist
  and routes missing values to authored fallback text. Deterministic everyday
  intents run after NPC and role scripts; seller and quest intents retain
  priority and authority.
- Protected `GET /life/catalog` returns the seeded shop catalog.
- Protected `GET /life/orders` returns the latest ten café orders for the
  signed-in player. Each order stores item names, quantities and unit prices as
  purchased, its total and timestamp.
- `POST /life/sleep` takes `{ key: UUID }`, accepts only 0–29 energy, and adds
  exactly 50 energy capped at 100 without changing the shared world clock.
- `POST /life/purchase` takes `{ key: UUID, itemIds: string[] }`: one item or
  one drink plus one food. Stores accept purchases only from 08:00 until 20:00.
  Prices come from PostgreSQL. Payment, café order history and
  consumption/wardrobe changes share a transaction. Clothes purchases are not
  included in café order history. Consumables create no inventory; shirts enter
  `owned_shirts` and equip immediately.
- `POST /life/appearance` takes `{ key: UUID, hair?, trousers?, shirtItemId? }`.
  Hair/trousers change freely; equipped shirts must already be owned. Skin stays
  unchanged.
- Life writes serialize on the character/stats rows. `player_actions` stores
  matching replay receipts; a reused key with different arguments returns 409.
  Exact retries remain valid after closing time. Tables deny direct
  `anon`/`authenticated` access.
- Each new server conversation message consumes one energy point in the same
  transaction; replay consumes none. Zero energy returns 409 with sleep/food
  guidance. Local practice is free.
- React's signed-in menu and its Settings, English Review and movement tutorial
  overlays capture player input without pausing NPC updates or the shared game
  clock. World-blocking dialogue, loading, sleep and offline states retain their
  existing pause behavior. Offline writes are disabled, and uncertain writes
  offer the same replay key for retry. Scene-owned derived textures preserve
  original animation frames and skin, and are released on transitions/teardown.
  The portrait remains the original artwork.
- `GET /tutorial/speech/:pageId` accepts only the five shared tutorial page IDs,
  requires authentication, and returns a short-lived URL for cached Azure Neural
  audio generated from server-trusted tutorial copy. The client never sends free
  text or Azure credentials. Signed-out local practice makes no speech request.

## Destination assets (T14 experiment)

Station art/voices remain bundled for first load and offline `/practice`.
Practice portals stay in the station. Signed-in destinations load public packs
on entry with progress, retry and an offline explanation; scene shutdown removes
previous textures, sounds/audio, JSON and animation keys. Storage URLs are never
included in PWA precache. The old destination PNG sources are retained as
reference art, but are no longer imported or built into the app.

Generated map files are kept outside the game bundle and Git in the ignored
`local-assets/maps/<mapId>/` directory. Recreate all three local packs without
Docker or Supabase using `pnpm assets:generate`; pass map IDs to limit output,
for example `pnpm assets:generate loc_cafe` or `pnpm assets:generate loc_tax_office`.
The Tax Office pack includes the authored interior plus Marcus and Nadia's
walking atlases and three-frame portrait strips. After local Supabase, migrations,
seed and NestJS are running, use
`pnpm run assets:upload -- --target local loc_town_street 1` (also `loc_cafe`,
`loc_clothes`, `loc_tax_office`). `SUPABASE_SERVICE_ROLE_KEY` comes from ignored local server
configuration; `CONTENT_API_URL` optionally overrides
`http://127.0.0.1:3000/api/v1` and must remain on localhost for the local
target. For an intentional production upload, run
`pnpm run assets:upload -- --target production loc_town_street 1` with
`PRODUCTION_CONTENT_API_URL` and `PRODUCTION_SUPABASE_SERVICE_ROLE_KEY` supplied
by the deployment environment. The URL must be HTTPS and non-local; the API must
be configured for that same production Supabase project. Production values are
never loaded from local `.env` files, and the service key remains server-side.
The upload script generates experimental SVG backgrounds, 32×48 player frames
and JSON walking definitions in `local-assets/maps/<mapId>/`, then uploads each
through NestJS. The ignored local copies remain available to inspect, back up or
upload again. Failed uploads leave the files in place for retry. Original map
artwork and station NPC atlases, portraits, and Kokoro-generated voice clips can
be copied from `apps/game/assets` into map-organized ignored folders with
`pnpm assets:archive`. Station voice clips are grouped under each matching NPC
by the scripted dialogue text; shared lines are copied to each NPC that uses
them. Tutorial narration is kept separately. This includes `loc_station` and the
current tax-office art. The archive command preserves the source files because
the station is still bundled into the game and loaded directly by `/practice`.
Destination packs require a map background, `player` spritesheet and an
animation JSON asset defining `walk-0` through `walk-3`; definitions contain
`key`, `texture`, numeric `frames`, `frameRate` and `repeat`. Optional NPC
art/voices and JSON are loaded with the same pack; shop conversations remain
separate later tasks.

Town Street dialogue uses Kokoro recordings (`af_heart` / `am_michael`, speed
0.95), matching the station's generator. `pnpm voices:street -- --upload`
generates the authored role/global lines in
`local-assets/maps/loc_town_street/audio` and registers audio plus
`street-voices.json` through the existing local asset API.
`pnpm voices:street:check` decodes every clip and checks silence/clipping. The
client resolves text/gender through that manifest and streams only the requested
MP3; these files are excluded from Phaser's eager pack download and the station
PWA precache. Failed NPC recordings show a retry message instead of silently
switching to a browser voice. Station recordings remain unchanged.

Measured 2026-10-10: initial built asset payload **15,047,847 → 7,121,361
bytes** (14.35 → 6.79 MiB; uncompressed bytes, not network timing). Public
precache: 6.81 MiB. Town Street/café/clothes packs: **6,202 / 6,191 / 6,193
bytes**. `/tests/map-pack-browser.html` on Vite verifies ten real station/street
round trips: texture allocation remains **6,408,800 bytes**, with stable
texture/cache/animation, scene-object and listener counts. This proves bounded
Phaser resources; it is not a garbage-collection-controlled JavaScript heap
profile. Physical phones remain unverified.

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
- `pnpm ai:evaluate -- --provider=mock` prints the 20-message AI evaluation set,
  all T10d unsafe-input cases, every reply and its safety flags. Select
  `--provider=gemini` only for an intentional live-key evaluation; it uses the
  configured server-only `AI_API_KEY` and `AI_MODEL`, calls no game API and
  changes no account or database state.
- `pnpm test:integration`: real local Supabase/Postgres tests; requires setup.
  The rollback-only T10c–T10e test reuses `test@gmail.com`: from `apps/server`,
  set `T10_TEST_PASSWORD`, build, then run
  `node --import ./scripts/load-env.mjs --test dist/tests/ai.integration.test.js`.
  It uses the mock by default; set `T10_LIVE_TEST=true` to require a real Gemini
  reply with the configured key/model. Neither mode starts an HTTP server. The
  T17 seller test creates and removes its own local Auth account and rolls back
  all game-data changes. To run only it, build the server, then run from
  `apps/server`:
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
Production AI provider quotas, persistent CEFR promotion and additional speech
providers remain future decisions. See `TASKS.md` before extending scope.
