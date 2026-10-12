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
Read MASTER_PROMPT.md and implement task T4 from docs/TASKS.md.

Follow all applicable project instructions.

Complete the task, verify the acceptance criteria, update its status if verified, report briefly, and stop.

Do not start server here. The project is running on VS code terminal
Do not create Git commits. Just suggest a commit message for me; I will commit manually.
Please test using the account I provided. Don’t create a new user for each test.
test@gmail.com / 12341234.
```

## DONE

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
      saved 2× UTC clock, café purchases, shirt ownership/equipping, opening
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
      weather, tired/fine/sick, the station and hometown, with three
      personality replies each. Topic and fallback unit tests plus a seven-turn
      rollback-only integration test using the existing account passed.
- [x] **T20 — Clothes shop and wardrobe:** seller order/confirmation, atomic
      payment, owned shirt quantity and “My items” list; reload and outfit
      preservation verified with the existing account.

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
- Item lists and prices live in content (`content/seed/shops.json`), never in
  code. Codex must not invent prices: the owner supplies or approves them.
- Energy is 0–100; each player message to an NPC costs 1 point, with retries
  charged once. Drinks restore 20, food/snacks 50, drink + food 80 total
  (10-point bonus), capped at 100. Consumables apply immediately without
  inventory; payment and effects must be atomic.
- Sleep instantly advances the player's saved game clock by 8 hours and restores
  energy to 100. Opening hours use game time: organizations 08:00–16:00, stores
  08:00–20:00, workplaces 07:00–17:00.
- Appearance uses separate hair, shirt and trouser colors, saved with the
  character. The first shop catalog has blue/green/red/yellow shirts at $30
  each.

## NEXT

- [x] **T21 — Game clock speed and display.** Make the clock speed one config
      value (now 2×; the owner approves the new value, test with 6×). Changing
      the speed must not make saved clocks jump: store the game time, the real
      time and the speed at the last save. Keep sleep (+8 hours). Use one shared
      function to check opening hours for stores, organizations and workplaces.
      Show the game time (HH:MM and weekday) in the HUD, and say the opening
      hours when a place is closed. Done when: tests cover a speed change,
      sleep, a reload, and the store boundaries (07:59, 08:00, 19:59, 20:00);
      browser check at 320/375/1024px.
- [x] **T22 — Order history (all shops except clothes).** Save every completed
      purchase in one shared table: user, shop, items with quantity, price at
      the time of purchase, total, and time. Write it in the same transaction as
      the payment. Inspect the existing order storage first and reuse it if
      possible. Done when: one purchase creates one record, a replayed confirm
      creates none, a failed payment creates none, a later price change does not
      change old orders, a player reads only their own orders, and records stay
      after reload.
- [ ] **T23 — Shop menu with images and order list (after T22).** In the seller
      conversation, show the menu as cards with an image and a price, and a
      short list of the player's recent orders. Images are listed in
      `content/seed/shops.json`; the owner supplies or approves them. Show a
      placeholder when an image is missing. Done when: all 10 café items show an
      image and the correct price, recent orders show after reload, and the
      browser check passes at 320/375/1024px.
- [ ] **T12 — Minimal review screen.** Past corrections and the useful phrases
      the player used in shops ("I'd like…", "How much is…"). Store useful terms
      only, not every word. Done when: after ordering coffee, the screen shows
      the phrase and one correction.
- [ ] **T10a — AI provider interface and mock.** Server-only `AiProvider`
      interface, a mock provider, and `.env` settings (`AI_PROVIDER`,
      `AI_API_KEY`, `AI_MODEL`). On error, timeout or 429, return a scripted
      fallback line. AI never changes money, items or quest state. Done when:
      tests pass with the mock, and the fallback works.
- [ ] **T10b — Gemini provider (after T10a and T19).** `GeminiProvider` with a
      free key (fake data only). No Gemini-only features. Prompts in one file.
      Done when: one NPC reply comes from Gemini, and changing `AI_PROVIDER`
      needs no change outside the provider class.
- [ ] **T10c — Streaming and limits (after T10b).** SSE streaming, saved token
      usage, free-chat cap and rate limit. Done when: text streams word by word,
      and the limits work with the mock.
- [ ] **T10d — Evaluation set.** 20 test messages and one command that runs them
      against a chosen provider. Done when: the command prints all 20 replies.
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
