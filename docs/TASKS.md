# TASKS — one small board

Current client: **Vite + React DOM + TypeScript + Phaser 4 + PWA (D16)**.
Native/Expo/WebView tasks are retired.

Done: NPC-01–NPC-09; ONB-01.1–ONB-01.6, ONB-01.8; T36a–T36g; T38.1–T38.6;
T39.1–T39.5; T40.a–T40.e; T41.a–T41.d; T42.a–T42.e, T42.e2a–T42.e2b, T42.f, T42.g1, T42.g2a–T42.g2b, T42.h, T42.i; S2–S7; T43.a.

## How to work

- Complete only the task the user requested. If the user explicitly says
  "continue" without a task, select the first unchecked **NOW** item.
- **No guessing — stop for owner review when unclear:** If any requirement,
  API/DB contract, schema, coordinate, or target file is missing, ambiguous,
  or conflicts with existing code, **do not guess, invent workarounds, or edit
  files on your own**. Stop immediately, list every concrete issue (file paths,
  symbols, options) for the owner to review, and wait for approval.
- Inspect code first; change the smallest set of files; test what changed. New
  client features go under `src/features/<feature>`; new server capabilities go
  in NestJS `src/modules/<domain>`. Migrate legacy folders only when needed by
  the task; don't do a standalone folder reshuffle or create empty layers.
- Create and switch to a suitably named task branch before changing files; never
  implement directly on `dev` or `main`. Don't create commits, planning
  documents, reports, progress logs or new agent sessions automatically. Add
  necessary source/tests/migrations. The user owns merging completed work.
- Mark a task done here **only after verification**. Reply with a short summary,
  checks, blockers and a user-testing checklist split into **Client** and
  **Backend/API**. Each applicable test states its **Precondition**, exact
  **Input/Action** and observable **Expected output**; use **Not applicable**
  when one side is unaffected. The AI directly runs complex backend checks that
  are impractical through the client when safe tooling and required
  infrastructure are available, and identifies any remaining manual checks. Do
  not start the following task automatically.
- Keep this board short: when a task is done, collapse it into one line under
  DONE. Git keeps the history.
- Do not read `docs/art-direction/` for tasks that do not create, edit, name,
  review, integrate, or upload art/audio assets. When an asset task does require
  it, first read `docs/art-direction/STYLE.md`, then open only the reference
  images and supporting files relevant to that specific asset; do not scan the
  whole directory. Follow the selected references exactly and do not invent
  missing visual details. Generate only drafts first, display every result in
  chat, and wait for explicit visual approval. Then ask separately for
  permission to use the approved asset. Only after that second approval may the
  AI move it into the reviewed source location or update content, code,
  manifests, generation scripts, loaders, tests, and maintained docs that
  reference it.
- Asset approval is not production-upload approval. After local integration,
  generate and inspect the runtime pack, run relevant verification, then run
  `pnpm assets:upload -- --dry-run --target production <mapId>`. Report the
  exact target, logical keys, upload/update/skip counts, proposed versions and
  failures, and ask for explicit permission to perform the production upload.
  Only after that approval may the AI run
  `pnpm assets:upload -- --target production <mapId>`. Upload through the NestJS
  content API using deployment-provided credentials; never write directly to
  production PostgreSQL or Storage, never expose credentials, never overwrite
  immutable bytes, and never delete unexpected remote assets.
- For every approved new asset, update only the files actually required by its
  ownership and runtime path: reviewed source, content/catalog entry, typed
  asset manifest when present, generator/exporter, map loader or scene, focused
  tests, and durable documentation. A new map folder additionally requires its
  supported-map registration and server location/content data. Do not create
  empty folders or speculative production configuration. Example task request:

```text
Read docs/MASTER_PROMPT.md and implement task T4 from docs/TASKS.md.
Follow all applicable project instructions.

Complete the task, verify the acceptance criteria, update its status if verified, report briefly, and stop.

Do not start server here. The project is running on VS code terminal
Do not create Git commits. Just suggest a commit message for me; I will commit manually.
Please test using the account I provided. Don’t create a new user for each test.
test@gmail.com / 12341234.
client: localhost:8082
backend: localhost:3000
database: https://wedjinchhlybabstcchp.supabase.co
```

### Model Tiers (use the lightest eligible tier per slice)

- `[Model: Gemini Flash]` — **Tier 1 (Light):** Pure UI/CSS/Tailwind components from existing props, `JobTicket` minigame engines, static `content/` JSON, small config/doc/test edits.
- `[Model: Gemini Hydrogen]` — **Tier 2 (Mid):** Multi-file wiring following existing repo patterns, React state + API hooks, NestJS endpoints/repositories using existing guards/transactions, Phaser scene integration, integration tests, CLI scripts, doc refactors.
- `[Model: Claude Sonnet — Exception only]` — **Tier 3 (Heavy):** New greenfield core architecture with no repo precedent, complex DB concurrency/locking bugs, or audio worklet/PWA sync edge cases.
- `[Manual]` — Human/device browser verification or external dashboard ops (not an AI coding slice).

## NOW

- [ ] **T42 — Airport Prologue & English Check-in Flow.** Replace the static
      country dropdown and immediate $500 balance with an interactive airport
      prologue. The player sets name and avatar on a Passport card, spawns at the
      Departure Terminal map, approaches the counter NPC to check in luggage and
      state their destination country in English, watches a brief airplane flight
      cutscene, lands at Baggage Claim to locate their suitcase, receives the
      starter $500 cash upon claiming, and exits to `loc_station` to begin life in town.
  - [x] **T42.a — Core Types, Contracts & Location Schema (Shared & UI Props).** Add
        `loc_airport_departure` and `loc_airport_arrival` to `playerMapIdSchema`
        and `playerPlaceIdSchema`; define `PassportDraft`, `ClaimBaggageRequest`,
        `ClaimBaggageResponse`, `AirportPrologueStep`, and `AirportPrologueState`
        in `packages/shared`, along with client component props (`FlightCutsceneProps`,
        `BaggageClaimOverlayProps`).
  - [x] **T42.b — Airport Locations Migration & Content Seeds.** Add forward
        migration for `loc_airport_departure` and `loc_airport_arrival` in
        `locations`; seed airport places into `town.json`, `npc_airport_agent`
        into `npcs.json`, prologue quest `q_airport_prologue` into `quests.json`,
        and check-in dialogue into `dialogues.json`.
  - [x] **T42.c — Asset Pipeline Scripts & Map Pack Registration.** Extend
        `scripts/generate-map-assets.mjs` and `scripts/sync-map-assets.mjs`
        to include `loc_airport_departure` and `loc_airport_arrival` in
        supported maps and background definitions using the 128×192 player atlas.
  - [x] **T42.d — Airport Art Assets Generation & Approval Gates.** Follow
        `docs/art-direction/STYLE.md` 3-gate contract (visual approval, permission
        to use, dry-run upload) for airport terminal backgrounds, luggage props,
        and agent spritesheet/portraits.
  - [x] **T42.e — Backend Character Spawn & Idempotent Starter Funds.** Update
        `players.repository.ts` to spawn new characters at `loc_airport_departure`
        with 0 initial coins; add idempotent `claimStarterBaggage` endpoint in
        `economy.service.ts` to grant the $500 starting balance upon claiming luggage.
  - [x] **T42.e2 — Airport Check-in Backend Contract & NPC Registration.** `[Model: Gemini Hydrogen]`
        - [x] **T42.e2a — Shared Contracts & Airport Schemas.** `[Model: Gemini Flash]` Add `npc_airport_agent` to `conversationNpcSchema`, add `setDestinationCountrySchema` (`{ countryId }`), and make `Character.cityId`, `countryId`, `countryName` nullable.
        - [x] **T42.e2b — Airport Check-in Backend Endpoints & Atomic Country Lock.** `[Model: Gemini Hydrogen]` Bridge `PassportDraft` onboarding with existing `countryId`/`world_id` rules: add `createPassportSchema` (`PassportDraft`, optional `countryId`) + `POST /players/passport` and `POST /players/destination-country` (`{ countryId }`) in `players.controller.ts` / `players.service.ts` / `players.repository.ts`; allow `PlayersRepository.getPlayer` and `WorldClockService.read` fallback while `current_map_id = 'loc_airport_departure'` and `country_id IS NULL`; lock `country_id` + `world_id` + `current_city_id` atomically when `POST /players/destination-country` runs during airport departure.
  - [x] **T42.f — Client Passport Card UI.** `[Model: Gemini Flash]`
        Redesign `apps/game/src/app/new-game/index.tsx` into a 1-page Passport Card collecting `name`, `gender`/`avatarId` (from `content/seed/avatars.json` & `playerAssets`), and preserving the existing `userMode` (`kid`/`adult`) selector. Call `POST /players/passport` via `api/client.ts` & `session-provider.tsx` (`startPassportLife`) without a static country dropdown, then route to `/home` (`loc_airport_departure`).
  - [x] **T42.g1 — Phaser Airport Departure & Arrival Scene Wiring.** `[Model: Gemini Hydrogen]`
        Extend `MapLocation` in `apps/game/src/types/gameplay/world.ts` (`'airport_departure' | 'airport_arrival'`), map them explicitly in `features/location/player-location.ts`, register both in `features/shops/venue-npc-config.ts` (`airport_departure`: `['npc_airport_agent']`, `airport_arrival`: `[]`), and update `create-station-game.ts` / `station-navigation.ts` with `mapIds`, player spawn `(768, 370)`, `npc_airport_agent` `(768, 420)`, walkable bounds (`1536×1024`), and departure gate portal (`(768, 920)`).
  - [x] **T42.g2a — Backend Airport Conversation Wiring.** `[Model: Gemini Hydrogen]`
        Add `AIRPORT_NPC_IDS` to `TRANSIENT_SERVICE_NPC_IDS`, open `npc_airport_agent` with `airport_agent_start`, and let `ConversationsRepository.context()` work while `country_id IS NULL`.
  - [x] **T42.g2b — Airport Check-in Dialogue & Destination Country Extraction (Client).** `[Model: Gemini Hydrogen]`
        Add an airport conversation (wrap `SavedConversation` + `createConversationController` like `TownspersonConversation`; `ConversationPanel` is offline/station-only) wired from `StationScreen.tsx`. Client-side: fuzzy-match the player's text against `loadOptions().countries` (name contains, not exact); on a match call `POST /players/destination-country` BEFORE sending the message (`{countryName}` in `airport_agent_checked_in` needs the country set), then unlock the departure gate portal.
  - [x] **T42.h — Flight Cutscene Transition.** `[Model: Gemini Flash]`
        Implement `apps/game/src/features/onboarding/FlightCutscene.tsx` strictly matching `FlightCutsceneProps` in `types/ui/gameplay.ts` (3–4s airplane flight CSS animation using semantic `--color-*` tokens, reduced-motion friendly), triggered from `StationScreen.tsx` after boarding the departure gate and transitioning to `loc_airport_arrival`.
  - [x] **T42.i — Baggage Carousel Interaction & Starter Funds Claim.** `[Model: Gemini Hydrogen]`
        Add `claimStarterBaggage(token, idempotencyKey)` in `apps/game/src/api/client.ts`, add an interactive baggage claim zone/prop on `loc_airport_arrival` in `create-station-game.ts` + `BaggageClaimOverlay.tsx` (`BaggageClaimOverlayProps`), invoke `POST /players/claim-baggage` with a UUID `idempotencyKey` to grant $500 and refresh `PlayerState`, then unlock the exit portal directly to `loc_station` (entering the existing Train Station arrival flow).
  - [ ] **T42.i2 — Airport Dialogue Intent Understanding (reduce hardcoded keywords).** `[Model: Gemini Hydrogen]`
        Today `DialogueService.reply()` matches raw `intents[].keywords` per NPC, so every new phrasing (e.g. "I will fly to Germany") needs a manual JSON patch. Replace with reusable understanding, in 3 small slices. Server owns progression; AI only picks from the node's authored intents (fail-closed to `unclear`).
        - [ ] **T42.i2a — Airport Destination via Country Entity Match.** `[Model: Gemini Flash]` In `apps/server`, at `npc_airport_agent` nodes, detect a non-negated valid country from `countries` (reuse `matchCountry` logic in `packages/shared`, skip negated clauses like `"Not Germany"`, no verb list) and route to `airport_agent_checked_in`. Simplify `content/dialogue/npc_airport_agent.json` while keeping `pnpm content:validate` passing (no empty `keywords: []`; remove repeated verb lists or keep minimal valid schema) and re-seed DB. Works with AI off. Tests: `"Germany"`, `"to Germany"`, `"i will fly to germany"`, `"Not Germany"` (no match), `"Hello"` (no match), plus newcomer (`country_id = null`) and already-locked country.
        - [ ] **T42.i2b — Shared Input Normalization for `DialogueService`.** `[Model: Gemini Hydrogen]` Export the lexicon normalizer from `packages/shared/src/dialogue/intent-detector.ts` (fillers, contractions, clause split) and apply it in `dialogue.service.ts` by matching against **both** raw normalized text and filler-stripped/contraction-expanded text (so existing keywords containing articles/fillers like `"excuse me"`, `"check in my luggage"`, `"a ticket"` never break). No content changes; run existing dialogue tests + `pnpm content:validate`.
        - [ ] **T42.i2c — AI Intent Fallback & Subtle Error Recast for Quest/Navigation Nodes.** `[Model: Gemini Hydrogen]` In `conversation-scripted-reply.service.ts` + `ai.service.ts` (`classifyIntent`), when rules do not match AND the current node has `intents`, ask AI to choose one of that node's `intents[].name` (+ `unknown`) as validated JSON; follow its `next`. Exclude chit-chat nodes (avoid a second AI call before free chat), `TAX_OFFICE_NPC_IDS` (sensitive ID-card flow), `SHOP_NPC_IDS` (own seller profiles), and explicit refusals (`refused`). Honor `ai.enabled`, `aiUsage.limited` / `recordAiUsage`, timeout; log rule-miss/AI-hit phrases (no PII) for later rule tuning. **Subtle error correction (recast):** preserve and verify gentle English recasting alongside the matched quest/navigation reply — when AI is enabled and the learner's message has a clear grammar error, weave the natural English phrasing subtly into the NPC reply (without announcing a correction, while keeping the authored progression info intact), falling back to the exact authored line when AI is off/limited or the sentence is already natural; also verify `<GrammarFeedbackTag />` remains active on airport turns. Tests: valid choice, invalid/low-confidence/timeout → `unclear`, refusal guard, excluded NPCs, AI disabled, and subtle recast verification.
  - [ ] **T42.j — Integration Testing & Full Verification.** `[Model: Gemini Hydrogen]`
        Update `apps/server/src/tests/players.integration.test.ts` and `first-run.integration.test.ts` to cover `POST /players/passport`, `POST /players/destination-country`, airport check-in, and baggage claim; run `pnpm typecheck`, `pnpm test`, `pnpm content:validate`, and `pnpm test:integration`.

- [ ] **T43 — Dual-Mode Architecture (Kid & Adult) & Pluggable Job Minigame Framework.**
      Build an adaptive learning architecture where English is the primary tool to progress,
      work, and interact. Both modes share the underlying engine while dynamically adapting
      visuals, navigation, HUD, dialogue inputs, and minigames based on `userMode: 'kid' | 'adult'`.
      All voice and pronunciation features use the project's studio TTS architecture (Kokoro-82M
      offline MP3s + Azure Neural TTS via `createProcessedAudio` with `@soundtouchjs/audio-worklet` DSP),
      strictly eliminating robotic browser Web Speech synthesis.
  - [x] **T43.a — Core Contracts, userMode Persistence & Dual Input Shell.** Add
        `userMode` to `playerPreferencesSchema` and database migration; implement CSS
        theme tokens, settings mode toggle, touch `VirtualJoystick`, `KidDialogueInput`,
        `AdultDialogueInput`, `GrammarFeedbackTag`, and baseline `JobShellModal` + `AssemblyEngine`.
  - [ ] **T43.b1 — Wordbook Data Catalog & Kokoro Offline Audio Helper.** `[Model: Gemini Flash]`
        Create `apps/game/src/features/learning/wordbook-data.ts` (Kid phonics/emoji items + Adult `A1/A2/B1` CEFR entries with definitions and example sentences) and a small playback helper wrapping `createProcessedAudio` (`apps/game/src/speech/processed-audio.ts`) backed by pre-generated Kokoro-82M MP3s (`kokoro-js` in `package.json`) — zero `window.speechSynthesis`.
  - [ ] **T43.b2 — Wordbook HUD Trigger & Modal View.** `[Model: Gemini Flash]`
        Add the `📖` Wordbook HUD button in `StationScreen.tsx` (following the `<1024px` Mobile HUD rule) and `apps/game/src/features/learning/WordbookModal.tsx`: Kid Mode renders illustrated flashcards with phonics + audio replay; Adult Mode renders searchable `A1/A2/B1` CEFR vocabulary lists with audio replay, using semantic `--color-*` tokens only.
  - [ ] **T43.c — Contextual Dynamic Word Cards Tray for Dialogue.** `[Model: Gemini Flash]`
        Create pure mapper `apps/game/src/features/dialogue/word-cards.ts` resolving `WordCard[]` from active `npcId`, `nodeId`, and venue/quest vocabulary; wire into `KidDialogueInput.tsx` (`cards` + `onSpeakWord` using the `T43.b1` `createProcessedAudio` helper) replacing `DEFAULT_KID_WORD_CARDS` fallback when contextual cards exist.
  - [ ] **T43.d1 — Server Job Completion Endpoint & Trigger Metadata.** `[Model: Gemini Hydrogen]`
        Add optional `jobTrigger` (`{ jobId, ticket }`) to `turnMetadataSchema` in `packages/shared/src/conversations.ts` and emit it when seller/NPC order dialogue confirms; add transactional, idempotent `POST /jobs/complete` accepting `JobShiftReport` (`job-engine.ts`) in NestJS (`economy` / `jobs` module) using `wallet_ledger` (`idempotency_key = job:<idempotencyKey>`) and server-side reward lookup by `jobId` (never trusting client reward numbers).
  - [ ] **T43.d2 — Client Dialogue ↔ JobShellModal Bridge.** `[Model: Gemini Hydrogen]`
        Update `apps/game/src/features/shops/ShopConversation.tsx` (replacing the manual `sampleJobTicket` trigger) and `api/client.ts`: auto-open `JobShellModal` when `turn.jobTrigger` arrives, submit `JobShiftReport` to `POST /jobs/complete`, refresh player XP/coins (`refreshPlayer(true)`), and post the post-shift completion reply back into the conversation.
  - [ ] **T43.e1 — Job Gameplay Archetype: Sorting & Classification Engine.** `[Model: Gemini Flash]`
        Implement `apps/game/src/features/jobs/engines/SortingEngine.tsx` matching `JobTicket.sortingBins` and `AssemblyEngine.tsx` report contract (`JobShiftReport`, `calculateJobStars`). Use touch-friendly tap-to-assign (plus optional pointer/drag) so mobile `320px/375px` works without new drag libraries; wire `sorting` case in `JobShellModal.tsx`.
  - [ ] **T43.e2 — Job Gameplay Archetype: Matching & Inspection Engine.** `[Model: Gemini Flash]`
        Implement `apps/game/src/features/jobs/engines/MatchingEngine.tsx` matching `JobTicket.matchingCriteria` for document/stamp inspection (airport passport control, tax office approval) returning `JobShiftReport`; wire `matching` case in `JobShellModal.tsx`.
  - [ ] **T43.e3 — Job Gameplay Archetype: Precision Gauge & Timing Engine.** `[Model: Gemini Flash]`
        Extend `JobTicket` in `packages/shared/src/job-engine.ts` with optional `timingConfig` (`targetMin`, `targetMax`, `speedMs`) and implement `apps/game/src/features/jobs/engines/TimingEngine.tsx` for slider/meter precision sweet spots returning `JobShiftReport`; wire `timing` case in `JobShellModal.tsx`.
  - [ ] **T43.e4 — Multi-Industry Job Registry & Sample Shift Scenarios.** `[Model: Gemini Flash]`
        Expand `apps/game/src/features/jobs/registry/job-registry.ts` and `sample-configs/` with sample jobs across all 4 archetypes (Barista, Mail Sorter, Passport Inspector) including customer `JobTicket` configs and unit tests for `calculateJobStars` / config validity.
  - [ ] **T43.f — Overworld Proximity Interaction Bubbles & Themed Mode Signage.** `[Model: Gemini Hydrogen]`
        Extract bubble/signage helper `apps/game/src/features/npcs/npc-bubbles.ts` (avoid bloating `create-station-game.ts`), add `setUserMode(mode: UserMode)` on `StationGame` (`types/gameplay/world.ts`), and render floating proximity bubbles above nearby NPCs + mode-themed venue signage overlays (Kid icons vs Adult English signs) using `UI_COLORS`.
  - [ ] **T43.g — Full Integration & Verification.** `[Model: Gemini Hydrogen]`
        Add focused unit/component tests across Kid & Adult modes and new job engines; run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm content:validate`, `pnpm build`, and `pnpm check:pwa`.

- [ ] **ONB-01 — One-page country setup, shared country clocks and quick rest.**
      Replace the multi-screen country/avatar/name flow with one short first-run
      screen. A player chooses one of the 247 authored countries and a valid
      character name; the server atomically assigns the country's shared
      immutable clock world and the existing generic starter location. Sleep
      becomes a five-second rest that restores energy without moving world time.
      Implement only one numbered slice per request, keep each slice green, and
      do not start the next slice automatically.
  - [ ] **ONB-01.7 — Legacy clock cleanup and release verification.** `[Model: Gemini Flash]` *(Migration `033_remove_per_player_clock.sql` and `apps/server/src/tests/legacy-clock-cleanup.integration.test.ts` already exist; verify remaining references, update docs, and run checks.)*
        Verify repository search finds `clock_time`/`clock_anchor`/rebase/time-skip names only in historical migrations/tests (note: `clock_rate` on `worlds` is the active 6× world clock), update `docs/GAME.md` and `docs/TECH.md` with the final durable behavior, and run `content:validate`, `lint`, `typecheck`, `test`, `build`, `test:integration`, and `check:pwa`.

- [ ] **NPC speech audio prototype (Azure TTS + client DSP).** Complete the
      following slices in order. Keep the test scope to a few shared lines,
      NPC-specific lines, and AI fallback replies for one NPC. Do not mark the
      parent complete until every slice passes.
  - [ ] **S1 — NPC gender content and approval.** `[Model: Gemini Flash]` *(Migrations `023_npc_gender.sql`, `024_npc_gender_values.sql` and `gender` fields in `content/seed/npcs.json` & `street-npcs.json` already exist.)*
        Verify schema validation requires `gender` (`male` or `female`) on every NPC (confirm removing one `gender` makes `pnpm content:validate` fail), and list the existing NPC `gender` table for owner approval.
  - [ ] **S8 — End-to-end mobile verification.** With the existing test account,
        verify audio quality, response time and CPU behavior on supported mobile
        browsers, plus fixed/AI reuse, emotion/style, signed-URL expiry and
        stale AI cleanup. Record only concise results here by marking verified
        slices; then collapse the completed parent into DONE.
    - [x] Focused automated checks: fixed/AI reuse, emotion/style mapping,
          signed-URL retry behavior and stale AI cleanup (2026-10-20).
    - [x] Authenticated Chromium check: replay works without console errors and
          dialogue has no horizontal overflow at 320/375 px (2026-10-20).
    - [ ] `[Manual]` Physical Android Chrome: audio quality, response time and CPU
          behavior.
    - [ ] `[Manual]` Physical iOS Safari: audio quality, response time and CPU behavior.
    - [ ] `[Manual]` Live signed-URL expiry and fixed/AI cache reuse against local storage.

- [ ] **Shop polish follow-up (browser checks only).** `[Manual]` Code, 173 unit tests,
      typecheck, lint, build, content and PWA checks already pass. Remaining:
      refresh the old cached PWA, then check both shop maps, conversations, NPC
      movement and 320/375/1024px layouts with the existing test account. Done
      when: all these browser checks pass.

## APPROVED DESIGN (2026-10-10) — shops and money

- New characters start with **$500**. The database field stays `coins`; the UI
  shows `$`.
- The **station café** and the **clothes shop** each have two NPCs: a **seller**
  (lists items, takes the order, charges money) and an **assistant** (the café
  waiter, the shop assistant: friendly small talk, and for any order says
  "please ask the seller").
- Asking how to leave the station: either NPC points to the **receptionist**.
- **Scripts first.** Orders, prices and payments are deterministic dialogue +
  server state. AI never decides a price or a charge. AI free chat comes later,
  for chat only.
- **AI:** use a free Gemini key for development only (fake data, never real
  learners). The production AI provider is decided later, so everything goes
  through one provider interface.
- **AI routing (2026-10-15):** every NPC may use AI, but the server checks the
  scripts first. When no script understands the message, AI continues the
  conversation for every NPC. Pending orders and quest steps remain scripted; AI
  never changes money, items or quest state.
- Item lists and prices live in content (`content/seed/shops.json`), never in
  code. The agent must not invent prices: the owner supplies or approves them.
- Energy is 0–100; each player message to an NPC costs 1 point, with retries
  charged once. Drinks restore 20, food/snacks 50, drink + food 80 total
  (10-point bonus), capped at 100. Consumables apply immediately without
  inventory; payment and effects must be atomic.
- **Approved ONB-01 replacement:** countries have shared immutable clock worlds
  running at 6× server elapsed time. Sleep becomes a five-second rest available
  below 30 energy; it adds 50 energy and never moves world time. Until ONB-01 is
  complete, the current per-player eight-hour sleep remains legacy behavior, not
  the target contract. Opening hours remain cafés 08:00–21:00, organizations
  08:00–16:00, stores 10:00–20:00, supermarkets 07:00–22:00 and workplaces
  07:00–17:00 in country-local game time.
- Appearance uses separate hair, shirt and trouser colors, saved with the
  character. The first shop catalog has blue/green/red/yellow shirts at $30
  each.
- **Mobile HUD (2026-10-14, T28/T29):** below 1024 px there is one menu button
  (top-right). Sound and voice controls live in Settings inside the menu;
  server-owned safe recasts are always enabled and have no toggle. The profile
  card is compact. The minimap (show/hide) sits in the top-right column under
  the menu button.

## NEXT

- [ ] **T36 — ID card quest (guided, step by step).** The only guided quest: the
      Goals list shows every step: (1) go to the tax office, (2) ask a staff
      member to register an ID card, (3) answer the questions and give a photo,
      (4) check and confirm, (5) receive the ID card. Use the existing
      ordered-step quest system; do not build a new quest framework. One task,
      done in order a to i. Tick each step when it passes its own check. New
      art, portraits and voice clips use the existing asset pipeline (T14).
      Reward: the owner decides (default none). The agent must not invent
      anything the owner has not given: stop and ask.
  - [x] **a. Tax office and staff.** Inspect what exists. The tax office is a
        map with an entrance from Town Street and **two named staff NPCs**;
        either one can run the whole flow. Three emotion portraits each. Opening
        hours from the shared check (organizations 08:00–16:00); a closed office
        says its hours. Check: the player can walk in and chat with both staff.
  - [x] **b. Services Q&A.** Staff open with “Hello! How can I help you?” and
        wait for the player to ask. When asked what they can help with, staff
        list their services: **register an ID card** (works now) and **update ID
        card information** at the tax office. Cards cannot be lost or damaged in
        the game, never expire and remain valid permanently, so they do not need
        re-issue or renewal flows. The service list is content, so more services
        can be added later without code. A player who says they do not have an
        ID card is routed to registration. Check: each question gets the right
        scripted answer; AI never answers service questions.
  - [x] **c. Application conversation.** The staff member asks four questions, one at
        a time: **name**, **date of birth**, **address**, and **where you come
        from**. Gender comes from the immutable character choice and is never
        asked again. Then the photo (step d). Then the staff member reads
        everything back, photo included: "Is this correct?". **Nothing is saved
        to the card until the player says yes.** Until then the four entered
        answers wait in a server-owned pending state; character gender is copied
        from the saved character (the photo is not part of it, see d), so
        leaving and returning during the same running game resumes at the saved
        step, while closing/reloading the game clears the unfinished application
        and starts it from the beginning. "No" lets the player fix any entered
        answer. The pending answers are removed when the card is issued or the
        application is cancelled. Address rule: there is no literal "skip"
        command. If the player naturally explains that they do not have an
        address yet, will provide it later, or are in temporary accommodation,
        the address is `null` using conservative, server-owned authored intent
        phrases; unclear wording gets a retry rather than an AI guess. Any other
        text of 1 to 120 characters is stored as the address. A bad answer gets
        a friendly retry (date of birth: a real date, not in the future, year
        1900 or later; name and origin: plain text of 1 to 60 characters). Safe
        server recasts remain always enabled. Check: answers kept in order;
        resume after reload; natural no-address explanations give `null`,
        literal "skip" gets a retry, character gender is copied server-side, and
        "12 Maple Street" is stored.
  - [x] **d. Photo (upload or camera): kept in the browser until the player confirms.**
        After the four questions the staff member asks for a photo. The chat panel offers **Upload photo**,
        **Take photo** and **Use my character picture** (skips the photo). Use a
        file input (`accept="image/*"`) for uploads. **Take photo** opens a live
        `getUserMedia` camera preview on supported browsers with explicit
        Capture and Cancel controls; it never silently falls back to the file
        picker. The client shows a preview from local memory
        (`URL.createObjectURL`) with "Use this" and "Choose another", and scales
        the picture down in the browser (longest side about 1200 px), which also
        keeps the upload small. **Nothing is sent to the server and nothing is
        stored anywhere until the player confirms.** The photo is held in memory
        only: never in localStorage, IndexedDB, Cache Storage or the service
        worker. It is cleared when the player cancels, leaves the office, signs
        out, or the card is issued. A reload loses it, and the staff member
        simply asks for the photo again. When the player types a confirmation
        such as "Yes, issue my card", the server recognizes it and tells the
        client to submit. The NPC displays the answers as a list with the
        selected photo beside them, then speaks only the confirmation question
        asking whether the player wants to edit something or issue the card; no
        separate issue button is shown. The player photo-selection bubble shows
        the preview instead of the internal option label. Confirmation returns
        the NPC acknowledgement with its speech without streaming it. Once that
        message has finished presenting, a spinner appears beneath it while the
        client sends **one request**: `POST /me/id-card` (authenticated, rate
        limited, multipart: conversation id, idempotency key, optional photo).
        In that request the server checks that the conversation is at the
        confirmed step with all answers, validates and processes the photo
        **before any write** (accepts JPEG, PNG or WebP by content, not by file
        name, up to 5 MB and a maximum pixel count; rejects SVG, GIF and other
        types; auto-rotates, strips all metadata (EXIF and GPS), crops to a 3:4
        portrait, resizes to about 300×400 and re-encodes; use a small,
        well-known library, suggested `sharp`, and report the choice), stores
        the photo in a **private** Storage bucket (never the public
        `game-assets` bucket) at one fixed path per player
        (`<userId>/id-photo`), creates the card and completes the quest step. If
        the database step fails, the stored photo is removed in the same
        request, and a retry overwrites the same path, so no orphan files pile
        up and no cleanup job is needed. After a network failure the player
        retries with the same idempotency key (no duplicate card). The spinner
        stops and the NPC's issued message is shown and spoken only after that
        request returns `issued: true`, giving the player an explicit final
        result. If the committed result must be recovered after a lost response,
        the NPC appends a fresh completion message instead of reusing the
        earlier acknowledgement. Once a card exists, Tax Office registration
        requests offer only updates; the player can name the field to edit and a
        successful update ends with an explicit updated message and another
        offer of help. Having a card never replaces the Tax Office's normal
        opening greeting; the NPC mentions the existing card only after an
        ID-card request. Editing an existing text field saves immediately,
        clears the edit flow and ends with the NPC's updated message and offer
        of further help. Editing a photo uploads immediately after the player
        selects it, skips the application summary and confirmation question,
        then refreshes the visible player portrait from the returned signed
        photo URL. The photo is shown only to its owner through a short-lived
        signed URL created by the server, is never cached by the service worker,
        never sent to the AI, and never visible to other players or in NPC
        chats. Check: nothing reaches the server or storage before the
        confirmation (a test watches the network); "no" and leaving the office
        send nothing; wrong file types, a renamed file, an oversized file and a
        huge-pixel image are rejected before anything is stored; a photo with
        GPS data comes out without any metadata; a failed database step leaves
        no stored photo; a retry with the same key creates one card and one
        photo; another player cannot read the photo; the signed URL expires; a
        reload asks for the photo again; a camera-permission denial falls back
        to the file picker with a clear message.
  - [x] **e. ID number.** Shown
        as **`YYYYMMDD-XXXX`**: the date of birth, a hyphen, and 4 random
        digits. Stored as 12 digits without the hyphen (text, leading zeros
        count); the hyphen is added only for display by one shared function. The
        4 random digits are unique: a unique index on the whole number, secure
        random source, generated inside the issuing transaction, retry on a
        collision (up to 20 times), then a friendly "please try again later".
        The **last digit is odd for male and even for female** (default
        position, owner confirms). One card per player: a replayed confirm
        returns the same card and creates nothing. Check: format, parity, hyphen
        display, uniqueness under forced collisions, two simultaneous
        applications with the same birth date and gender get different
        numbers.
  - [x] **f. Storage, API and updates.** Table `player_id_card`
        (one row per user: `number` unique, `fullName`, `birthDate`, `address`
        nullable, `gender`, `origin`, `photoPath` nullable, `issuedAt`,
        `updatedAt`). The card remains valid permanently. `GET   /me/id-card`
        returns the card and a signed photo URL. Updating card information is
        allowed only through the Tax Office conversation flow. Server functions
        for later quests: `hasIdCard(userId)`, `hasAddress(userId)`, and
        `setIdCardAddress(userId, address | null)` for the future "rent a flat"
        quest. Check: ownership; plain-text storage; `<script>` stays text; the
        card remains valid as the game clock advances; direct client attempts to
        update it outside the Tax Office flow are rejected.
  - [x] **g. ID card icon and info panel.** A small ID card icon sits on the compact profile
        card, shown only once the player has a card. Tapping it opens a panel
        with the photo (or the character picture), the number as
        `YYYYMMDD-XXXX`, name, date of birth, gender, origin, and the address. A
        null address renders as `N/A` with an inline `!` affordance that shows
        “Go to the Tax Office to update.” on hover and keyboard focus.
        Read-only, with no permanent-validity text. The ID card icon is a 44px
        target; if it cannot fit on the card at 320 px without making the card
        wider than half the screen, put it in the first row of the profile
        section opened from the card. Plain-text rendering, a text alternative
        for the photo, keyboard and screen-reader use. Check: hidden before the
        card, shown after; the panel persists after reload, remains valid when
        the clock is moved forward, and exposes the update hint to pointer and
        keyboard users; no overlap at 320, 375 and 1024 px.
  - [ ] **h1. Quest wiring (Server & Content).** `[Model: Gemini Hydrogen]`
        Add `q_id_card` (5 ordered steps, default reward none) to `content/seed/quests.json`
        and seed migration; wire idempotent quest completion when `IdCardService.issue`
        succeeds (accepting either `npc_tax_clerk_marcus` or `npc_tax_clerk_nadia`),
        returning friendly scripted hints on out-of-order attempts without side effects.
        Check: replay, two simultaneous requests, reload, and `pnpm content:validate` fails for missing step/unknown NPC.
  - [ ] **h2. Quest wiring (Client HUD & NPC Marker).** `[Model: Gemini Flash]`
        Display `q_id_card` steps in `QuestBoard.tsx`, mark active Tax Office NPC (`npc_tax_clerk_marcus` / `npc_tax_clerk_nadia`)
        with the yellow `!` tag in Phaser, and mark Tax Office on the minimap while active.
  - [ ] **i. Privacy and final checks.** `[Model: Gemini Hydrogen]` + `[Manual]` *(Browser check depends on `P3`)*
        Verify in tests & code: name, date of birth, address, origin, the ID number and
        the photo are never sent to the AI prompt (`npc-prompt.service.ts` / `ai-evaluation.ts`) and never logged in
        production; account deletion removes `player_id_card` and the Storage photo.
        Check UI copy says: `"Use your character's details, not your real personal data."`
        `[Manual]` Browser check with the existing account at 320, 375 and 1024 px after `P3`:
        map, both staff, full flow with upload and camera, confirmation, card icon/panel, Goals, no overlap/horizontal scroll.

- [ ] **MAP-01 — Unified data-driven map collision, movement & A\* pathfinding.**
      Replace the 4 fragmented hardcoded navigation/collision implementations
      (`town-street-collision.json`, `station-navigation.ts`, `shop-navigation.ts`,
      airport obstacles) with one pure-TS SDF collision engine, gradient wall-sliding
      mover, and A\* pathfinder in `packages/shared`, driven by per-map
      `content/maps/<mapId>/map-data.json` delivered via `MapPack` (offline `/practice`
      `loc_station` imports the same repo file directly). No server code changes needed;
      keep `applyResponsiveLayout` viewport zoom (`1536×1024`) unchanged while
      `cameras.main.setBounds` reads scaled `width/height` from `map-data`.
  - [ ] **MAP-01.1 — Shared map schema & 8px geometry SDF engine.**
        Add `mapDataSchema` (`polygon`/`circle`/`rect`, `displayScale`, per-map
        `playerRadius`, `portals` with optional `radius`/`showLabel`/`gate`, `spawns`)
        and pure-TS narrow-band 8px geometry SDF baker (per-shape expanded AABB loops,
        `max` walkable union, `regionId` connected-component labels, bilinear sampling,
        `moveWithSlide` with gradient sliding + axis fallback when `|grad| ≈ 0`, and
        runtime dynamic NPC circular blockers) in `packages/shared`. Relax
        `packActorsSchema` bounds in `packages/shared/src/assets.ts` from `1536×1024`
        to `8192×8192`. Done when: `pnpm typecheck && pnpm test` pass, including union
        intersection/concave-corner tests and a `4096×4096` (200 obstacles) bake benchmark
        (target `< 25 ms`).
  - [ ] **MAP-01.2 — Shared A\* pathfinder & path smoothing.**
        Implement binary min-heap A\* on the 8px SDF grid in `packages/shared`: 8-dir
        movement without corner cutting, $O(1)$ `regionId` unreachable rejection,
        proportional `maxNodes` cap, runtime dynamic NPC avoidance, line-of-sight
        smoothing verified by `moveWithSlide`, and lazy NPC approach candidate search.
        Done when: `pnpm typecheck && pnpm test` pass, including corner-cut/NPC detour
        tests and a `4096×4096` long-range path benchmark (target `< 8 ms`).
  - [ ] **MAP-01.3 — Migrate `loc_town_street` (pilot + parity).**
        Author `content/maps/loc_town_street/map-data.json` (temporarily imported
        directly until `MAP-01.5`), switch street navigation to the shared engine, and
        delete `town-street-collision.json/.ts` and legacy `map-collision.ts`. Done
        when: 10,000-point parity test vs legacy `canWalkTownStreet` achieves `≥ 99.5%`
        agreement (diffs strictly within `≤ playerRadius` of edges) and `pnpm typecheck
        && pnpm test` pass.
  - [ ] **MAP-01.4 — Migrate remaining 7 maps & remove hardcoded navigators.**
        Author `content/maps/<id>/map-data.json` for `loc_station`, `loc_cafe`,
        `loc_corner_cafe`, `loc_clothes`, `loc_tax_office`, `loc_airport_departure`,
        and `loc_airport_arrival`. Add 10k-point parity tests (`≥ 99.5%`) per map;
        remove hardcoded obstacle arrays, legacy `movePlayer`/`moveInShop`/`moveInAirport`,
        and legacy BFS `findPath` while keeping venue open/close hours logic intact.
        Done when: `pnpm typecheck && pnpm lint && pnpm test` pass.
  - [ ] **MAP-01.5 — MapPack delivery, generic `StationScene` & `content:validate`.**
        Update `scripts/sync-map-assets.mjs` to include `content/maps/<mapId>/map-data.json`
        as the `map-data` JSON asset on `pnpm assets:upload`, parse `map-data` in
        `phaser-pack.ts`, and generalize `create-station-game.ts` to read bounds, scale,
        portals, spawns, and collision/pathfinding from `mapData` (keeping offline
        `/practice` `loc_station` importing `content/maps/loc_station/map-data.json`).
        Extend `pnpm content:validate` to validate all `map-data.json` files with
        `mapDataSchema` and verify portal/spawn reachability via SDF `regionId`
        flood-fill. Done when: `pnpm typecheck && pnpm lint && pnpm test && pnpm
        content:validate && pnpm build` pass.
  - [ ] **MAP-01.6 — Universal DEV `?collision` overlay & map authoring guide.**
        Extend `collision-debug.ts` to render on all 8 maps in DEV when `?collision` is
        present (walkable/obstacle shapes, effective `playerRadius` contour, live NPC
        colliders, unscaled art-space `(x, y)` cursor readout, and JSON export) and add
        a concise "How to add a map" doc. Done when: `?collision` works on all 8 maps
        (disabled in production builds) and `[Manual]` walk-through passes on all 8 maps.

## BLOCKED — start only after the Open decisions below are answered

- [ ] **P1 — Hosted Supabase.** `[Manual]` Migrations, seed and production Auth settings.
      Done when: a new account can sign in on the hosted project.
- [ ] **P2 — Hosting, CORS and rate limits.** `[Manual]` + `[Model: Gemini Flash]` (config/env) HTTPS for the app and the server.
      Done when: the app works on a public address.
- [ ] **P3 — Privacy note.** `[Model: Gemini Flash]` Short note: speech audio may go to the browser
      vendor; the optional ID card photo is private and removed with the
      account. Done when: the note is shown in the app.

## LATER — only when explicitly requested and policies are decided

- [ ] **UI-01 — Implement the approved UI component art direction.** Apply
      `docs/art-direction/refs/ui-components-reference.png` to the existing web
      UI in small, reviewable slices; this reference defines visual direction,
      not exact screen layout or permission to replace working behavior. First
      inventory the real shared primitives and feature-owned components, then
      implement only the slice explicitly requested. Reuse the semantic palette
      and existing CSS/Tailwind infrastructure; add a semantic token only when a
      genuinely new role is required. Do not introduce hard-coded component
      colors, generated bitmap buttons/panels, a parallel design system, new UI
      libraries or a whole-app rewrite.
  - [ ] **UI-01.1 — Foundations and shared primitives.** `[Model: Gemini Hydrogen]` Map the reference to
        documented semantic roles for primary, secondary and disabled buttons;
        compact information panels; dialogue panels; tooltip bubbles;
        information and quest markers; inventory slots; and ID-card icons.
        Update the smallest existing shared primitives first and preserve their
        public APIs where practical. Cover hover, active, focus-visible,
        disabled, loading and error states. Check: component tests prove state
        behavior and keyboard operation; contrast and focus indicators remain
        accessible; no feature flow changes.
  - [ ] **UI-01.2 — Feature adoption.** `[Model: Gemini Flash]` Migrate one explicitly requested feature
        at a time to the approved primitives, starting with components that are
        already shared rather than duplicating styles inside feature folders.
        Preserve copy, authorization, server-owned state and responsive layout.
        Check each slice at 320, 375 and 1024 px with no overlap, clipping or
        horizontal scroll, and verify its existing focused tests still pass.
  - [ ] **UI-01.3 — Cleanup and final consistency audit.** `[Model: Gemini Flash]` Only after all
        requested feature slices are adopted, remove styles proven unused and
        search for accidental hard-coded colors or duplicate primitives. Do not
        delete legacy styles still used by an unmigrated feature. Done when the
        approved component categories have one maintained implementation,
        accessibility checks pass, relevant screenshots are owner-approved, and
        game tests, typecheck, lint and production build pass.
- [ ] **DOC-01 — Split maintained game and technical references by domain.** `[Model: Gemini Hydrogen]` *(Trigger met: `docs/TECH.md` is 798 lines.)*
      Keep `GAME.md` and `TECH.md` as
      short entry points and move detail into cohesive `docs/game/` and
      `docs/tech/` files. Product behavior belongs under `game/`;
      implementation, interfaces and operations belong under `tech/`. Start with
      the smallest justified domain set; do not create one file per feature,
      quest, NPC or venue. Update `AGENTS.md` with domain-based reading routes
      and repair all affected links. This is a documentation-only refactor:
      preserve every current rule, source-of-truth boundary and task reference
      without changing product behavior. Check: every moved section has exactly
      one canonical location, both index files link to all domain files,
      repository references resolve, searches find no obsolete anchors or
      duplicated normative rules, and a before/after section inventory proves no
      maintained content was lost.
- [ ] **T37 — Library and CV (start only after T36).** One task, done in order a
      to g. Tick each step when it passes its own check. Art, portraits and
      voice clips use the existing asset pipeline (T14).
  - [ ] **a. Library map.** `[Model: Gemini Flash]` (content/map-pack config) + `[Model: Gemini Hydrogen]` (scene wiring)
        New map "Library" with an entrance on Town Street. It appears in
        the map pack and the minimap. Check: the player can walk in and leave.
  - [ ] **b. Librarian.** `[Model: Gemini Flash]`
        A named NPC with scripted small talk, three emotion
        portraits, and opening hours from the existing shared check (default:
        organization hours, 08:00–16:00). A closed library says its hours. Check:
        the player can chat with her; closed hours show the dialogue.
  - [ ] **c. CV conversation.** `[Model: Gemini Hydrogen]`
        When the player asks how to make a CV (or a resume),
        she offers help and asks five questions, one at a time: your name, the job
        you want, what you can do well, your work experience, the languages you
        speak (owner approves the wording). The pending state lives on the server,
        so leaving and returning resumes at the saved question. "I don't know"
        gets a short example answer, never a skip. At the end: "Shall I save it?".
        If a CV exists she offers to update it. Safe server recasts remain always
        enabled. Check: the five answers are kept in order, and the flow resumes
        after a reload.
  - [ ] **d. CV storage and API.** `[Model: Gemini Hydrogen]`
        Table `player_cv` (one
        row per user: `name`, `desiredJob`, `skills`, `experience`, `languages`,
        `updatedAt`). `GET/PUT /me/cv`. Plain text, trimmed, at most 300
        characters per field, no control characters, every field required. A
        player reads and edits only their own CV. Check: a replayed confirm
        creates one CV; empty or over-long fields are rejected; `<script>` is
        stored as plain text; another player cannot read it.
  - [ ] **e. Server check for later quests.** `[Model: Gemini Flash]`
        Expose a server function
        `hasCompleteCv(userId)`, true only when a complete CV exists. No quest
        changes in this task; the future job quest will use it. Check: complete CV
        → true; incomplete → false.
  - [ ] **f. CV in the profile.** `[Model: Gemini Flash]`
        In the profile
        section, a CV icon appears only once a CV exists. It opens a panel with
        the five labelled fields and an Edit button; the edit form has counters,
        Save, Cancel, and a warning for unsaved changes, plus the note "Use your
        character's details, not your real phone number or address." Plain-text
        rendering only. Editing costs no energy. Check: hidden before the CV,
        shown after; edits persist after reload; keyboard and screen reader
        work.
  - [ ] **g. Privacy and final checks.** `[Model: Gemini Hydrogen]` + `[Manual]`
        CV text is never sent to the
        AI prompt and never logged in production; account deletion removes it.
        Browser check with the existing account at 320, 375 and 1024 px: map,
        librarian, the full flow, icon and edit panel, no overlap, no horizontal
        scroll. Done when a to g are ticked and the AI evaluation shows no CV text
        in any prompt.
- [ ] **OPS-01 — Production asset reconciliation and deploy prewarm.** Build a
      manifest-driven deployment gate after P1 Hosted Supabase. The command must
      compare required assets with production metadata and private/public
      Storage without exposing service credentials. Read-only check is the
      default; creation/upload requires explicit `--apply`. Never generate map,
      portrait or sprite artwork during deploy, never overwrite a different
      checksum under the same version, and never delete unexpected assets.
      Implement only one slice per request. This infrastructure does not bypass
      the art approval contract: static art must pass visual approval,
      permission-to-use approval, reviewed local integration and a production
      dry run before a separately approved production mutation.
  - [ ] **OPS-01.1 — Canonical manifest and read-only reconciliation.** `[Model: Gemini Hydrogen]` Define a
        typed manifest for required map backgrounds, portraits, spritesheets,
        atlases, fixed NPC audio and the five tutorial narration pages. Add
        `pnpm assets:reconcile -- --target production --check` to validate local
        sources/checksums, query production through server-owned interfaces and
        report `valid`, `missing`, `stale` or `invalid` per logical key. Exit 0
        only when every required asset is valid; exit 1 for missing/stale/
        invalid assets; configuration or network failure must be distinguishable
        and fail closed. Tests cover duplicate keys, changed checksum without a
        version bump, malformed atlas/frame contracts, unavailable production
        configuration and zero mutation in check mode.
  - [ ] **OPS-01.2 — Reviewed static-asset upload.** `[Model: Gemini Hydrogen]` Add explicit `--apply` for
        missing versioned maps, portraits, spritesheets and atlases sourced only
        from the reviewed local archive. Reuse the existing content asset API,
        production URL/key safeguards and immutable version rules. Identical
        retries reuse the existing object; partial failure reports every failed
        key and leaves successful immutable uploads intact. Do not generate art,
        overwrite mismatched bytes, rewrite unrelated pack references or remove
        bundled station/PWA assets. Verify with mocked Storage/API tests and a
        non-production fixture reconciliation.
  - [ ] **OPS-01.3 — Azure fixed-audio prewarm.** `[Model: Gemini Hydrogen]` Extend `--apply` to synthesize
        only missing trusted fixed-speech entries, including all five tutorial
        pages, through the existing server-side Azure provider and private
        `speech-audio` cache. Cache identity must include exact text, voice,
        style, format, TTS version and settings; existing valid audio performs
        no Azure call. Reject arbitrary client text, keep AI/user-specific
        speech out of prewarm, bound concurrency, and report generation/upload
        failures without secrets. Tests prove missing-only generation,
        idempotent reruns, cache-version invalidation, signed-URL independence
        and safe partial failure.
  - [ ] **OPS-01.4 — Deployment gate and production smoke check.** `[Model: Gemini Hydrogen]` Add the
        sequence `content:validate` → build → reconcile `--apply` → reconcile
        `--check` → authenticated production smoke checks. The deploy fails if a
        required asset remains missing/invalid or any tutorial audio cannot be
        downloaded with the expected MIME type and non-zero bytes. Require HTTPS
        production endpoints and deployment-injected Azure/Supabase secrets;
        never load production secrets from local env files. Document rollback as
        deploying the previous manifest/code version; do not delete newer
        immutable objects automatically.
  - [ ] **OPS-01.5 — Production proof and maintained docs.** `[Manual]` + `[Model: Gemini Flash]` (docs) Against the
        approved production project, run check mode before apply, apply missing
        assets, rerun check mode and the smoke suite, then confirm a second
        apply creates and uploads nothing. Record only non-secret counts and
        failing logical keys. Update `docs/TECH.md` with required environment
        variables, permissions, bucket/migration prerequisites, commands,
        failure meanings and the station offline/PWA decision. Mark OPS-01
        complete only after the production run passes; do not treat mocked tests
        as production proof.
- **Production AI provider:** after the audience decision, compare providers
  with the evaluation set (quality, speed, price), check EU and under-18 terms
  and the data processing terms, add the provider class, and add the privacy
  note.
- NPC memory (T11), A1 tutorial for the playtest (T13), browser speech accuracy
  experiment (S0).
- **Job application** (decision first, see below). Light version: a scripted
  interview chat that ends with a "job offer" flag and XP, with no salary or
  work loop.
- Public website for SEO: a separate static site (landing, how it works, FAQ,
  privacy, sitemap); the game lives on its own address.

## Open product decisions — ask only if they block the current task

- ID card (T36): which digit carries the gender parity (default: the last
  digit); gender options beyond male and female (none for now, as specified);
  the quest reward (default none); the two staff names; the text for the whether
  the photo is required or optional (default optional, with the character
  picture as the fallback).
- Is AI free chat in the MVP, or after the first playtest?
- Does an AI chat message cost 1 energy, like a normal NPC message?
- AI chat audience and provider: adults 18+ only (paid tier), or a provider that
  allows teens, or no AI chat for minors. The free Gemini quota is for
  development with fake data only (its terms exclude EU/EEA/UK end users and
  apps likely used by under-18s).
- Shops: future main-meal items and prices; whether old test characters get a
  top-up to $500.
- Jobs: light interview only (suggested), or real jobs with pay and work time (a
  big feature, after the MVP).
- XP-to-level thresholds/CEFR promotion and AI free-chat limits.
- General AI/speech providers, production Auth recovery/verification policies,
  audio privacy/age/GDPR and final asset licenses.
- Domain name and hosting for the public site and the game.
- Starter-city expansion and final game name; technical character-name policy.
- Optional improvements: consolidate local vs server-authored dialogue, share
  suitable intent/grammar helpers, useful-vocabulary recording.

D16 cancels native Expo/WebView delivery. Items in LATER are not authority to
implement extra features during the current task.
