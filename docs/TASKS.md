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

- [x] **T29 — Minimap:** show/hide map under the menu button (owner revision:
      one responsive size, up to 90% width on mobile and 640 px on desktop;
      hidden below 1024 px by default; `M` key; tap outside or Escape hides).
      Player, NPC and exit markers, scaled labels, map name above the artwork,
      accessible canvas description, visible-only 10 Hz updates, no second
      camera. Verified 2026-10-15 on station, café, clothes shop and Town Street
      at 320/375/1024 px and in `/practice`; ten map switches kept correct
      markers and listener counts; Town Street frame median/p95 7.1/15.1 ms; 143
      game tests, typecheck, lint, build and PWA checks passed; no new precache
      files.
- [x] **T28 — Tidy mobile HUD:** compact profile card, one menu button with a
      Settings section (Sound, Coach), sound reachable during dialogue, smaller
      Goals with a status badge, free top-right column. Verified with the
      existing account on three maps and four widths: saved switches, narration
      mute, Coach visibility, Escape/focus, long name and wallet, 200% text.
      Game tests, typecheck, changed-file lint, build and PWA checks passed.
- [x] **T10b — Gemini provider:** centralized prompts and configuration-selected
      mock/Gemini adapter for unknown Town Street resident small talk. All 19
      focused tests, server build and changed-file lint passed. Existing-account
      rollback integration passed with mock and live `gemini-3.5-flash-lite`;
      saved replay and unchanged money/items/quests verified.
- [x] **T10c — Script-first AI routing:** every NPC checks pending state,
      authored scripts and content-derived topic words before AI; prompts use
      database persona, place/open status, learner level and six redacted turns.
      Verified with 27 NPCs × 7 scripted examples and the existing account;
      seller/receptionist/resident AI, replay, disabled AI and pending states
      passed in a rollback-only integration test.
- [x] **T10d — AI safety layer:** trims and bounds input before provider calls;
      rejects injection, economy manipulation, medical/personal-data requests,
      non-English text and emoji spam; validates short plain-English output with
      no gameplay claims, personal-data requests or medical advice. All required
      safety cases passed with the existing account in a rollback-only test.
- [x] **T10e — Chat endpoint, streaming and limits:** authenticated word-by-word
      SSE, atomic complete-reply persistence, AI usage/daily limits, one active
      stream per user, idempotent retry charging and disconnect rollback. Mock
      and rollback-only existing-account integration tests passed.
- [x] **T10f — Client AI chat UI:** existing saved dialogue streams words with
      thinking/cancel/error/offline states, confirmed AI labels, browser speech,
      completion announcements and a development disclosure. Conversation IDs
      resume authenticated history after reload. Browser checks passed at 320,
      375 and 1024 px with the existing account and fictional limit fixture.
- [x] **T10g — Evaluation set:** `pnpm ai:evaluate -- --provider=mock|gemini`
      runs 20 conversation messages plus all eight T10d unsafe-input cases,
      prints every message/reply and flags blocked input, unsafe output or
      provider failure. The mock evaluation and focused tests passed.
- [x] **T10a — AI provider interface and mock:** server-only text provider,
      mock/default configuration and authored fallback on errors, 429 or
      timeout. AI/dialogue tests (13), server build/typecheck and changed-file
      lint passed.
- [x] **Foundation:** monorepo, Vite/PWA client (D16), Supabase auth, NestJS
      token check, `/me`, character creation, migrations 001–004, authored seed,
      Zod content validation, API rate limiting (T6).
- [x] **Local `/practice` station:** three NPCs, browser speech, recorded voice,
      Coach, portals, public-only PWA precache. No rewards.
- [x] **Arrival quest (T4, T5, T7, T8, T9):** receptionist → bus ticket → Town
      Street → one-time XP/coins reward, saved on the server.
- [x] **T14 — Asset pipeline:** versioned Storage packs, dynamic map/NPC
      loading, station-only offline practice (measurements in `TECH.md`).
- [x] **T15 — Wallet and starting $500:** atomic starter grant, server-only
      spending, wallet ledger, replay/concurrency tests.
- [x] **T16 — Shop catalog:** 5 drinks, 5 snacks, 4 $30 shirts; seeded and read
      from the database.
- [x] **Life gameplay extension:** energy, sleep (+8 hours, below 50% only),
      saved 2× game clock, café purchases, shirt ownership/equipping, opening
      hours for stores, energy HUD. Tests and 320/375/1024px checks passed.
- [x] **T17 — Order and pay conversation (café seller):** saved orders, quantity
      1–3, price/change/cancel/unknown item, atomic payment, replay,
      insufficient funds, Coach correction. Six NPC atlas frames in shop maps.
      Clothes purchase is T20.
- [x] **T18 — Station café and Your First Coffee:** Mia cashier and waiter,
      directions to the receptionist, greet → order → pay → one-time 20 XP/$5
      reward. Browser flow, reload and 320/375/1024px verified.
- [x] **Local Supabase migration (2026-10-12):** game data and Auth users moved
      to `english-life-game` (54321/54322); 30 files and 15 asset downloads
      verified. Source volumes and recovery copies kept.
- [x] **T19 — Small-talk pools (scripted):** waiter topics for wellbeing,
      weather, tired/fine/sick, the station and hometown, with three personality
      replies each. Topic and fallback unit tests plus a seven-turn
      rollback-only integration test using the existing account passed.
- [x] **T20 — Clothes shop and wardrobe:** seller order/confirmation, atomic
      payment, owned shirt quantity and “My items” list; reload and outfit
      preservation verified with the existing account.
- [x] **T24 — Corner Cup:** Town Street entrance to the new café, seller/menu,
      assistant and three named customer NPCs with conversation access.
- [x] **T25 — Café product artwork:** Generated individual images for all ten
      café products, wired them into the catalog and confirmed them in the menu.
- [x] **T26 — Named NPCs and shop entry:** Named shop and station actors;
      removed hours/style controls from the Life menu; moved wardrobe to its own
      panel and gated closed-store entry with an hours dialogue. Tests and the
      existing-account menu/wardrobe browser check passed.
- [x] **T27 — Town Street residents:** 15 named residents across five road
      patrol routes, with editable profile/art links and authenticated scripted
      small talk. Content, movement, pack, type, build, and browser checks
      passed.
- [x] **T21 — Game clock speed and display:** clock speed is one config value;
      saved clocks do not jump when it changes; one shared opening-hours check;
      the HUD shows game time and weekday; closed places say their hours.
- [x] **T22 — Order history (all shops except clothes):** one shared purchase
      table written in the payment transaction; price at purchase time kept;
      players read only their own orders; replay and failed payment create none.
- [x] **T23 — Menu cards and order list in the seller chat:** cards with image
      and price for all 10 café items, recent orders in the same panel,
      placeholder when an image is missing. Browser checks passed.
- [x] **T12 — Minimal review screen:** past corrections and useful shop phrases.
      Verified: saved-account coffee integration, ownership/replay, reload
      persistence and 320/375/1024px browser checks.

## NOW

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
  conversation for every NPC. Pending orders and quest steps remain scripted;
  AI never changes money, items or quest state.
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

- [ ] **Q1 — Mr. Brown quest.** Add content only, no new framework code. Done
      when: the quest can be completed by typing, the reward is given once, and
      a refresh keeps it.
- [ ] **Q2 — Sam quest.** Content only. Same "Done when" as Q1.
- [ ] **Q3 — Heater quest.** Content only. Same "Done when" as Q1.

## BLOCKED — start only after the Open decisions below are answered

- [ ] **P1 — Hosted Supabase.** Migrations, seed and production Auth settings.
      Done when: a new account can sign in on the hosted project.
- [ ] **P2 — Hosting, CORS and rate limits.** HTTPS for the app and the server.
      Done when: the app works on a public address.
- [ ] **P3 — Privacy note.** Short note: speech audio may go to the browser
      vendor. Done when: the note is shown in the app.

## LATER — only when explicitly requested and policies are decided

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
