# TASKS — one small board

Current client: **Vite + React DOM + TypeScript + Phaser 4 + PWA (D16)**.
Native/Expo/WebView tasks are retired.

## How to work

- Complete only the task the user requested. If the user explicitly says
  "continue" without a task, select the first unchecked **NOW** item.
- Inspect code first; change the smallest set of files; test what changed. New
  client features go under `src/features/<feature>`; new server capabilities go
  in NestJS `src/modules/<domain>`. Migrate legacy folders only when needed by
  the task; don't do a standalone folder reshuffle or create empty layers.
- Don't create branches/commits, planning documents, reports, progress logs or
  new agent sessions automatically. Add necessary source/tests/migrations.
- Mark a task done here **only after verification**. Reply with a short summary,
  checks and blockers; do not start the following task automatically.
- Keep this board short: when a task is done, collapse it into one line under
  DONE. Git keeps the history.

Example task request:

```text
Read docs/MASTER_PROMPT.md and implement task T4 from docs/TASKS.md.

Follow all applicable project instructions.

Complete the task, verify the acceptance criteria, update its status if verified, report briefly, and stop.

Do not start server here. The project is running on VS code terminal
Do not create Git commits. Just suggest a commit message for me; I will commit manually.
Please test using the account I provided. Don’t create a new user for each test.
test@gmail.com / 12341234.
```

## DONE

Finished tasks are removed to keep this board short. Git history and
`docs/TECH.md` keep the details.

- [x] **NPC-01 — Stabilize the baseline before NPC work.** Disable Vite's test
      WebSocket so parallel tests do not contend for port 24678; keep the
      Corner Cup portal registered while its `label` remains empty because the
      map already renders the label; remove the invalid town `gender` schema
      field. Verified with focused portal checks plus game and server suites.

## NOW

- [ ] **T38 — Non-pausing game menu, synchronized Settings and movement tutorial.**
      Implement only one slice per request and stop after its checks. The menu
      and all utility overlays must leave NPC movement and game time running;
      they may capture player input. The approved design is
      `docs/specs/2026-10-21-game-menu-tutorial-design.md`, and the executable
      plan is `docs/plans/2026-10-21-game-menu-settings-tutorial.md`.
  - [x] **T38.1 — Server preference contract and persistence.** Add validated,
        authenticated storage for Coach, Voice Speed and Voice Pitch, including
        atomic first-device initialization, bounds, ownership and RLS tests.
  - [ ] **T38.2 — Client preference synchronization.** Keep Sound device-local;
        load/save account preferences through NestJS with slider debounce,
        latest-value-wins, visible failure state and Retry. Local practice must
        make no preference API calls.
  - [x] **T38.3 — Non-pausing game menu shell.** Extract the menu with English
        Review, Movement Tutorial, Sign Out/Leave Local Practice, Return to Game
        and Settings. Capture player input without pausing NPCs or game time.
  - [ ] **T38.4 — Separate Settings overlay.** Move full controls out of the
        game menu, preserve compact dialogue controls, add save/error feedback,
        and verify the layout at 320px, 375px and desktop width.
  - [ ] **T38.5 — Five-page tutorial behavior.** Implement page state, first-run
        `localStorage`, menu replay from page one, correct return destination,
        Back/Next/Skip/Start Exploring, arrow keys and Escape without pausing
        the simulated world.
  - [ ] **T38.6 — Tutorial art and final verification.** Add compact game-style
        illustrations, run responsive and behavioral checks, prove continuous
        NPC/time behavior, run repository gates and update maintained docs.

- [ ] **T39 — Complete controlled NPC presence for stations and stores.**
      Finish the partially implemented behavior in
      `docs/specs/2026-10-21-controlled-npc-presence-design.md`. Implement only
      one slice per request and stop after its checks. Keep Town Street on its
      existing authored server schedules; do not change quests, rewards, store
      hours or server authority.
  - [x] **T39.1 — Validated venue contract and country-local seed.** Replace the
        current loose client configuration with one validated shared contract
        for location, service/optional/ambient NPC IDs, time buckets, spawn
        zones and exclusion zones. Reject unknown or duplicate IDs, conflicting
        categories, invalid counts and unusable zones. Derive the deterministic
        date and morning/daytime/evening bucket from the selected country's
        game-local time, with one documented deterministic daytime fallback.
        Done when focused tests prove identical inputs are stable, date or
        bucket changes can change the roster, bounds hold, and every invalid
        configuration fails with its location and field identified.
  - [ ] **T39.2 — Station roster, assets and receptionist patrol.** Keep Ruth
        present as the existing receptionist identity and bundle her required
        asset locally. Keep exactly three stable passenger identities with
        matching name, portrait, sprite, voice and dialogue, selecting one or
        two per bucket without rerolling on portal re-entry. Constrain Ruth's
        patrol to the safe desk route and stop/resume it for interaction and
        world pause. Done when identity, asset-path, selection, navigation,
        arrival, directions, tutorial and patrol-boundary tests pass.
  - [ ] **T39.3 — Reusable café and clothes-store configuration.** Register the
        current station café, Corner Cup and clothes shop through the common
        venue registry. Keep required sellers/managers and current assistants
        as bundled service NPCs; select customers from each venue's ambient
        pool and customer-only zones. Closed stores remain inaccessible. A
        missing optional ambient asset skips that NPC with a non-sensitive
        diagnostic, while a missing required service definition or asset shows
        a location-load error. Done when adding a fixture venue needs only NPC
        definitions, zones and registry data—no selector changes—and focused
        store, asset-failure and opening-hours tests pass.
  - [ ] **T39.4 — Safe spawning and boundary reconciliation.** Make actor
        creation consume configured spawn and exclusion zones so ambient NPCs
        never block portals, counters, desks, fitting areas or primary paths.
        Reconcile actors only when the effective seed/configuration changes;
        retain an active speaker across a bucket boundary and reconcile after
        the conversation closes. World pause stops movement and resumes from
        the current route position. Undersized pools return each valid NPC at
        most once and emit a non-sensitive diagnostic. Done when focused Phaser
        tests cover placement, exclusion, pause/resume, conversation deferral,
        boundary changes and undersized pools.
  - [ ] **T39.5 — Regression, responsive QA and maintained docs.** Run focused
        game/shared tests, content validation, typecheck, lint, production game
        build and PWA checks. With the existing test account, inspect station,
        both café interiors and the clothes shop at 320px, 375px and desktop;
        verify NPCs do not block movement, counters or exits and repeated portal
        entry does not reroll a bucket. Update `docs/GAME.md` and `docs/TECH.md`
        only for final durable names and extension steps. Mark T39 complete only
        when all earlier slices and these regression/manual checks pass.

- [ ] **NPC speech audio prototype (Azure TTS + client DSP).** Complete the
      following slices in order. Keep the test scope to a few shared lines,
      NPC-specific lines, and AI fallback replies for one NPC. Do not mark the
      parent complete until every slice passes.
  - [ ] **S1 — NPC gender content and approval.** Require `gender` (`male` or
        `female`) on every NPC in validated content and `npcs.gender` through a
        forward migration. List the proposed value for every existing NPC for
        owner approval. The player's ID-card gender is unrelated. Done when
        content validation passes, removing one gender makes it fail, and the
        owner approves the proposals.
  - [x] **S2 — Voice pools and deterministic resolution.** Add one editable
        voice-pool content file with Azure voices per gender and optional
        `voiceOverride` values keyed by stable NPC ID. Resolve an override
        first; otherwise use a stable hash of NPC ID within its gender pool.
        Done when male/female selection, stability, same-gender variation,
        gender changes, and override precedence have focused tests.
  - [x] **S3 — Azure generation and emotion styles.** Add a server-only Azure
        TTS adapter. Map the three NPC emotions to a supported Azure style and
        use the default style when the selected voice lacks that style. Done
        when SSML escaping, supported styles, default fallback, provider errors,
        and generated audio metadata are tested without exposing the key.
  - [x] **S4 — Private fixed-script audio cache.** Generate one canonical file
        per cache key based on text, language, voice, style, format and TTS
        version/settings—never map, NPC ID, speed or pitch. Store private audio
        through the asset/storage boundary, keep only references and metadata
        in PostgreSQL, and return short-lived signed URLs to authenticated
        players. Done when shared lines reuse a file per voice, NPC-specific
        lines work, changed generation input invalidates the key, and retries or
        concurrent requests do not duplicate Azure calls/files.
  - [x] **S5 — AI reply audio cache.** Generate persisted AI reply text on
        demand, cache exact repeats for a configurable 30–3600 seconds, and
        never persist the source text or personal/sensitive text. Remove expired
        rows and objects. Done when exact repeats skip Azure, changed text does
        not, expiry removes the private object, and authored script routing still
        wins before AI fallback.
  - [x] **S6 — Authenticated client playback integration.** Attach speech to
        authenticated conversation responses without allowing arbitrary client
        text synthesis. Cover shared, NPC-specific, opening, history and AI
        replies; keep text readable when speech generation or signed URLs fail.
        Done when the existing test account can hear each covered reply and no
        private audio enters the service-worker cache.
  - [x] **S7 — Client DSP and settings.** Use one shared Web Audio
        `AudioContext` and `@soundtouchjs/audio-worklet` to change bounded speed
        and pitch independently after download. Add Game Settings controls;
        never create stored variants or include playback settings in cache keys.
        Fall back gracefully when AudioWorklet setup or playback fails. Done
        when focused tests cover persistence/bounds and browser playback proves
        independent controls plus fallback.
  - [ ] **S8 — End-to-end mobile verification.** With the existing test account,
        verify audio quality, response time and CPU behavior on supported mobile
        browsers, plus fixed/AI reuse, emotion/style, signed-URL expiry and stale
        AI cleanup. Record only concise results here by marking verified slices;
        then collapse the completed parent into DONE.
    - [x] Focused automated checks: fixed/AI reuse, emotion/style mapping,
          signed-URL retry behavior and stale AI cleanup (2026-10-20).
    - [x] Authenticated Chromium check: replay works without console errors and
          dialogue has no horizontal overflow at 320/375 px (2026-10-20).
    - [ ] Physical Android Chrome: audio quality, response time and CPU behavior.
    - [ ] Physical iOS Safari: audio quality, response time and CPU behavior.
    - [ ] Live signed-URL expiry and fixed/AI cache reuse against local storage.

- [ ] **Shop polish follow-up (browser checks only).** Code, 173 unit tests,
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
  code. Codex must not invent prices: the owner supplies or approves them.
- Energy is 0–100; each player message to an NPC costs 1 point, with retries
  charged once. Drinks restore 20, food/snacks 50, drink + food 80 total
  (10-point bonus), capped at 100. Consumables apply immediately without
  inventory; payment and effects must be atomic.
- Sleep instantly advances the player's saved game clock by 8 hours and restores
  energy to 100. Opening hours use game time: organizations 08:00–16:00, stores
  08:00–14:00, workplaces 07:00–17:00.
- Appearance uses separate hair, shirt and trouser colors, saved with the
  character. The first shop catalog has blue/green/red/yellow shirts at $30
  each.
- **Mobile HUD (2026-10-14, T28/T29):** below 1024 px there is one menu button
  (top-right). Sound and Coach on/off live in Settings inside the menu. The
  profile card is compact. The minimap (show/hide) sits in the top-right column
  under the menu button.

## NEXT

- [ ] **NPC life system — implement only one numbered slice per request.** Do
      not start the next slice automatically. All NPC facts must come from
      validated content/database data; missing facts get a natural non-answer.
      Server authority remains unchanged for quests, money, inventory, rewards,
      mood, presence and relationships. Store workers stay professional and
      customer-focused; social state never changes prices, stock, opening hours
      or transaction validity. These tasks do not change sleep or energy.
  - [x] **NPC-02 — Country-first onboarding: Sweden.** Add a validated country
        catalog and forward-only database structure. Seed Sweden with ID
        `country_sweden`, ISO `SE`, flag 🇸🇪 and IANA time zone
        `Europe/Stockholm`. Players choose a country, not a city. Keep the city
        hierarchy internal for later expansion and assign its starter city on
        the server. UI and dialogue show Sweden and generic location names such
        as Train Station and Town Street, never Maplewood. Done when shared
        contracts, server persistence, onboarding UI, content validation,
        migration checks and focused tests pass without exposing city choice.
  - [x] **NPC-03 — Versioned NPC profile JSONB.** Add strict
        `profileVersion: 1` content validation and `npcs.profile jsonb` through
        the next available forward migration. Support only authored optional
        facts such as age, hometown, family, hobbies, favourite food,
        likes/dislikes, conversation topics, temperament and daily routine.
        Author distinct profiles in `content/` rather than inferring or
        inventing facts. Done when malformed/unknown fields fail validation,
        every NPC seeds a profile, runtime reads the database value, and a
        missing fact cannot appear in a response.
  - [x] **NPC-04 — Data-driven mood catalog and base mood.** Add editable mood
        rows for neutral, happy, hungry, stressed, tired, relaxed, sleepy, sad,
        upset and angry; NPC mood references the catalog and defaults to
        neutral. Resolve base mood from server-owned game time in the selected
        country's IANA zone: morning happiness where temperament permits,
        hunger/stress around 11:00–12:00, tiredness after 16:00, relaxation
        after 19:00 and possible sleepiness around 21:00–22:00. Age may shift
        hunger/energy/sleep timing but must never imply anger or friendliness.
        Exceptional moods are deterministic per NPC/game date and limited to
        authored rules. Done when boundary, age, temperament, rollover and DST
        tests pass and no cron job is required.
  - [x] **NPC-05 — Server-authoritative NPC presence schedules.** Add validated
        weekly work/appearance slots to NPC profiles, including multiple shifts
        and overnight windows. Resolve them from game-local time and country
        time zone. Street NPCs without schedules are absent; store workers use
        authored shifts constrained by venue hours, with venue hours as the
        fallback only when their shift is missing. Return a presence allowlist
        and next boundary to the client; hide and disable absent actors. Reject
        a new conversation when an NPC is absent, but allow an already-open
        conversation to finish. Done when server, Phaser interaction, refresh,
        reconnect, boundary and failure-mode tests pass.
  - [x] **NPC-06 — Per-player NPC relationships and reactions.** Add persistent
        familiarity (0–100), affinity (-100–100), derived relationship stages,
        and an expiring per-player reaction mood. Use deterministic, bounded
        social signals for greetings, thanks, polite requests, apologies and
        explicit insults; learner mistakes and ambiguous messages cause no
        penalty. Save relationship changes in the same transaction as the
        conversation turn and reuse the existing message idempotency key.
        Done when caps, expiry, apology, concurrency and replay tests pass and
        store behaviour remains commercially identical.
  - [x] **NPC-07 — Database-backed natural everyday dialogue.** Cover name,
        age, origin, family, job, workplace, hobbies, food, preferences,
        books, music, art, pets, travel, school, local places, routines,
        current activity, plans, wellbeing, weather, thanks, apologies,
        compliments and farewells. Recognize natural English plus common learner
        forms such as “What you name?”, “How old you?” and “Where you from?”.
        Render only allowlisted values loaded from database context. Street NPCs
        may make broad small talk; store NPCs answer briefly and redirect to
        service. Preserve every quest/order intent, price and state transition.
        Done when exhaustive table-driven cases and all seller/quest regression
        tests pass without fabricated facts or hard-coded location names.
  - [x] **NPC-08 — Adaptive response level and mood-aware delivery.** Default to
        CEFR A2 when learner data is unavailable. Combine stored learner level
        and observable input complexity, moving at most one CEFR band per turn.
        Mood and relationship affect tone/length, never facts. AI prompts may
        receive only validated allowlisted NPC facts, place, effective mood,
        relationship stage and safe recent history; store prompts retain the
        service-first rule. Speech styles use only provider-supported mappings
        with a neutral fallback. Done when level bounds, prompt privacy,
        missing-fact and voice-style tests pass.
  - [x] **NPC-09 — Integration, documentation and release verification.** Merge
        the completed slices carefully with the speech/audio work; resolve
        forward-migration numbering without editing applied migrations. Update
        `docs/GAME.md` and `docs/TECH.md` once with the durable country, profile,
        mood, presence, relationship and dialogue contracts. Run content
        validation, typecheck, lint, unit tests and build; run integration tests
        only against the configured local Supabase and report unavailable
        infrastructure honestly. Check relevant UI at 320, 375 and 1024 px.
        Done only when the full repository gates pass and no unrelated changes
        are included.

- [ ] **T36 — ID card quest (guided, step by step).** The only guided quest: the
      Goals list shows every step: (1) go to the tax office, (2) ask a staff
      member to register an ID card, (3) answer the questions and give a photo,
      (4) check and confirm, (5) receive the ID card. Use the existing
      ordered-step quest system; do not build a new quest framework. One task,
      done in order a to i. Tick each step when it passes its own check. New
      art, portraits and voice clips use the existing asset pipeline (T14).
      Reward: the owner decides (default none). Codex must not invent anything
      the owner has not given: stop and ask. - [ ] **a. Tax office and staff.**
      Inspect what exists. The tax office is a map with an entrance from Town
      Street and **two named staff NPCs**; either one can run the whole flow.
      Three emotion portraits each. Opening hours from the shared check
      (organizations 08:00–16:00); a closed office says its hours. Check: the
      player can walk in and chat with both staff. - [ ] **b. Services Q&A.**
      When asked what they can help with, staff list their services: **register
      an ID card** (works now), **re-issue an ID card** and **renew an ID card**
      (information only for now: a scripted, owner-approved answer; the real
      flows come later). They also say the card is valid for 10 years. The
      service list is content, so more services can be added later without code.
      Check: each question gets the right scripted answer; AI never answers
      service questions. - [ ] **c. Application conversation.** The staff member
      asks five questions, one at a time: **name**, **date of birth**,
      **address**, **gender**, and **where you come from**. Then the photo (step
      d). Then the staff member reads everything back, photo included: "Is this
      correct?". **Nothing is saved to the card until the player says yes.**
      Until then the five text answers wait in a server-owned pending state (the
      photo is not part of it, see d), so leaving and returning resumes at the
      saved step, and "no" lets the player fix any answer. The pending answers
      are removed when the card is issued or the application is cancelled.
      Address rule: if the player says anything meaning "I don't have one yet",
      "later", "I'll update it later", "not now" or "skip", the address is
      `null` (the phrases are content the owner approves); any other text of 1
      to 120 characters is stored as the address. A bad answer gets a friendly
      retry (date of birth: a real date, not in the future, year 1900 or later;
      gender: male or female, as specified; name and origin: plain text of 1 to
      60 characters). Coach corrections still apply. Check: answers kept in
      order; resume after reload; each address phrase gives `null`, and "12
      Maple Street" is stored. - [ ] **d. Photo (upload or camera): kept in the
      browser until the player confirms.** After the five questions the staff
      member asks for a photo. The chat panel offers **Upload photo**, **Take
      photo** and **Use my character picture** (skips the photo). Use a file
      input (`accept="image/*"`, with `capture` for the camera) so it works in
      the phone PWA and falls back to the file picker on desktop. The client
      shows a preview from local memory (`URL.createObjectURL`) with "Use this"
      and "Choose another", and scales the picture down in the browser (longest
      side about 1200 px), which also keeps the upload small. **Nothing is sent
      to the server and nothing is stored anywhere until the player confirms.**
      The photo is held in memory only: never in localStorage, IndexedDB, Cache
      Storage or the service worker. It is cleared when the player cancels,
      leaves the office, signs out, or the card is issued. A reload loses it,
      and the staff member simply asks for the photo again. When the player says
      yes (typed, or the "Yes, issue my card" button, which sends the same
      message), the server recognizes the confirmation and tells the client to
      submit. The client then sends **one request**: `POST /me/id-card`
      (authenticated, rate limited, multipart: conversation id, idempotency key,
      optional photo). In that request the server checks that the conversation
      is at the confirmed step with all answers, validates and processes the
      photo **before any write** (accepts JPEG, PNG or WebP by content, not by
      file name, up to 5 MB and a maximum pixel count; rejects SVG, GIF and
      other types; auto-rotates, strips all metadata (EXIF and GPS), crops to a
      3:4 portrait, resizes to about 300×400 and re-encodes; use a small,
      well-known library, suggested `sharp`, and report the choice), stores the
      photo in a **private** Storage bucket (never the public `game-assets`
      bucket) at one fixed path per player (`<userId>/id-photo`), creates the
      card and completes the quest step. If the database step fails, the stored
      photo is removed in the same request, and a retry overwrites the same
      path, so no orphan files pile up and no cleanup job is needed. After a
      network failure the player retries with the same idempotency key (no
      duplicate card). The photo is shown only to its owner through a
      short-lived signed URL created by the server, is never cached by the
      service worker, never sent to the AI, and never visible to other players
      or in NPC chats. Check: nothing reaches the server or storage before the
      confirmation (a test watches the network); "no" and leaving the office
      send nothing; wrong file types, a renamed file, an oversized file and a
      huge-pixel image are rejected before anything is stored; a photo with GPS
      data comes out without any metadata; a failed database step leaves no
      stored photo; a retry with the same key creates one card and one photo;
      another player cannot read the photo; the signed URL expires; a reload
      asks for the photo again; a camera-permission denial falls back to the
      file picker with a clear message. - [ ] **e. ID number.** Shown as
      **`YYYYMMDD-XXXX`**: the date of birth, a hyphen, and 4 random digits.
      Stored as 12 digits without the hyphen (text, leading zeros count); the
      hyphen is added only for display by one shared function. The 4 random
      digits are unique: a unique index on the whole number, secure random
      source, generated inside the issuing transaction, retry on a collision (up
      to 20 times), then a friendly "please try again later". The **last digit
      is odd for male and even for female** (default position, owner confirms).
      One card per player: a replayed confirm returns the same card and creates
      nothing. Check: format, parity, hyphen display, uniqueness under forced
      collisions, two simultaneous applications with the same birth date and
      gender get different numbers. - [ ] **f. Storage, API and validity.**
      Table `player_id_card` (one row per user: `number` unique, `fullName`,
      `birthDate`, `address` nullable, `gender`, `origin`, `photoPath` nullable,
      `issuedAt`, `expiresAt`, `updatedAt`). The card is valid for **10 game
      years** from issue, measured with the saved game clock (inspect it: if the
      clock has no calendar year, use total elapsed game time, 3,650 game days).
      After that its status is `expired` and it must be redone.
      `GET /me/id-card` returns the card with its `status` and a signed photo
      URL. Server functions for later quests: `hasValidIdCard(userId)` (false
      when expired), `hasAddress(userId)`, and
      `setIdCardAddress(userId, address | null)` for the future "rent a flat"
      quest. An expired card makes the staff say it has expired and must be
      redone (the redo flow comes later). Tests use an injectable clock. Check:
      ownership; plain-text storage; `<script>` stays text; the card is valid
      one game-day before the 10-year limit and expired at it; `hasValidIdCard`
      follows. - [ ] **g. ID card icon and info panel.** A small ID card icon
      sits on the compact profile card, shown only once the player has a card.
      Tapping it opens a panel with the photo (or the character picture), the
      number as `YYYYMMDD-XXXX`, name, date of birth, gender, origin, the
      address or "Not set", the issue date, "Valid until", and a status (Valid
      or Expired). Read-only. The icon is a 44px target; if it cannot fit on the
      card at 320 px without making the card wider than half the screen, put it
      in the first row of the profile section opened from the card. Plain-text
      rendering, a text alternative for the photo, keyboard and screen-reader
      use. Check: hidden before the card, shown after; the panel persists after
      reload and shows Expired when the clock is moved forward; no overlap at
      320, 375 and 1024 px. - [ ] **h. Quest wiring.** The quest completes when
      the card is issued; the reward (if any) is given once; progress survives
      reload and sign-in; the NPC of the current step gets the yellow `!` tag
      and the minimap marks it. Out-of-order attempts get a friendly scripted
      hint and change nothing. Check: replay, two simultaneous requests,
      reload. - [ ] **i. Privacy and final checks.** Name, date of birth,
      address, origin, the ID number and the photo are never sent to the AI
      prompt and never logged in production; account deletion removes the card
      and the photo. The flow, the photo step and the card panel say: "Use your
      character's details, not your real personal data." The privacy note (P3)
      must also mention the photo before the playtest. Browser check with the
      existing account at 320, 375 and 1024 px: map, both staff, the full flow
      with an upload and with the camera, confirmation, the card icon and panel,
      Goals, no overlap, no horizontal scroll. Done when a to i are ticked,
      content validation fails for a missing step or an unknown NPC, and the AI
      evaluation shows no ID card data in any prompt.

## BLOCKED — start only after the Open decisions below are answered

- [ ] **P1 — Hosted Supabase.** Migrations, seed and production Auth settings.
      Done when: a new account can sign in on the hosted project.
- [ ] **P2 — Hosting, CORS and rate limits.** HTTPS for the app and the server.
      Done when: the app works on a public address.
- [ ] **P3 — Privacy note.** Short note: speech audio may go to the browser
      vendor; the optional ID card photo is private and removed with the
      account. Done when: the note is shown in the app.

## LATER — only when explicitly requested and policies are decided

- [ ] **T37 — Library and CV (start only after T36).** One task, done in order a
      to g. Tick each step when it passes its own check. Art, portraits and
      voice clips use the existing asset pipeline (T14). - [ ] **a. Library
      map.** New map "Library" with an entrance on Town Street. It appears in
      the map pack and the minimap. Check: the player can walk in and leave. - [
      ] **b. Librarian.** A named NPC with scripted small talk, three emotion
      portraits, and opening hours from the existing shared check (default:
      organization hours, 08:00–16:00). A closed library says its hours. Check:
      the player can chat with her; closed hours show the dialogue. - [ ] **c.
      CV conversation.** When the player asks how to make a CV (or a resume),
      she offers help and asks five questions, one at a time: your name, the job
      you want, what you can do well, your work experience, the languages you
      speak (owner approves the wording). The pending state lives on the server,
      so leaving and returning resumes at the saved question. "I don't know"
      gets a short example answer, never a skip. At the end: "Shall I save it?".
      If a CV exists she offers to update it. Coach corrections still apply.
      Check: the five answers are kept in order, and the flow resumes after a
      reload. - [ ] **d. CV storage and API.** Table `player_cv` (one row per
      user: `name`, `desiredJob`, `skills`, `experience`, `languages`,
      `updatedAt`). `GET/PUT /me/cv`. Plain text, trimmed, at most 300
      characters per field, no control characters, every field required. A
      player reads and edits only their own CV. Check: a replayed confirm
      creates one CV; empty or over-long fields are rejected; `<script>` is
      stored as plain text; another player cannot read it. - [ ] **e. Server
      check for later quests.** Expose a server function
      `hasCompleteCv(userId)`, true only when a complete CV exists. No quest
      changes in this task; the future job quest will use it. Check: complete CV
      → true; incomplete → false. - [ ] **f. CV in the profile.** In the profile
      section, a CV icon appears only once a CV exists. It opens a panel with
      the five labelled fields and an Edit button; the edit form has counters,
      Save, Cancel, and a warning for unsaved changes, plus the note "Use your
      character's details, not your real phone number or address." Plain-text
      rendering only. Editing costs no energy. Check: hidden before the CV,
      shown after; edits persist after reload; keyboard and screen reader
      work. - [ ] **g. Privacy and final checks.** CV text is never sent to the
      AI prompt and never logged in production; account deletion removes it.
      Browser check with the existing account at 320, 375 and 1024 px: map,
      librarian, the full flow, icon and edit panel, no overlap, no horizontal
      scroll. Done when a to g are ticked and the AI evaluation shows no CV text
      in any prompt.
- Production asset publishing: upload versioned map, NPC and Koko audio assets
  from the local archive to production Supabase Storage, update pack references,
  and decide the station offline/PWA cache behavior before removing bundled
  files.
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
  the quest reward (default none); the two staff names; the text for the
  re-issue and renew answers; whether the photo is required or optional (default
  optional, with the character picture as the fallback); whether the number
  stays the same when the card is redone (default same); and that the 10 years
  are measured on the game clock.
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
