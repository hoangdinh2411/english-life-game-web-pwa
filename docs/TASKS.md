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

Do not create Git commits. Just suggest a commit message for me; I will commit manually.
```

## DONE

- [x] **Foundation:** monorepo, Vite/PWA client (D16), Supabase auth and NestJS
      token check, health, database and access, onboarding options, `/me`,
      character creation, migrations 001–004, authored seed, Zod content
      validation, API rate limiting (T6).
- [x] **Local `/practice` station:** three NPCs, optional browser speech,
      recorded voice, Coach, portals, public-only PWA precache. No rewards, and
      separate from the server quest state.
- [x] **Arrival quest, end to end (T4, T5, T7, T8, T9):** receptionist dialogue
      → bus ticket → Town Street → one-time XP/coins reward. Saved on the server
      across reload and sign-in. Chat, optional Coach, ticket receipt, ordered
      progress and blocked-exit messages in the UI.
- [x] **T14 — Asset pipeline and dynamic map/NPC loading (experiment):** versioned Storage packs, service-key uploads, generated-file cleanup, station-only offline practice; unit/integration/PWA checks and ten browser portal round trips verified (sizes and resource-memory measurements in `TECH.md`).

## NOW

No active NOW item. Select another task only when requested.

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

## NEXT

- [ ] **T15 — Wallet and starting $500.** Server grants the starting balance to
      new characters from a config value. Add a wallet ledger table (new
      migration: user, amount, reason, reference, idempotency key, time) and one
      server function `spend(amount, reason, key)`: transactional, never below
      $0, the same key never charges twice. Existing characters keep their
      balance. Update the one economy note in the docs. Done when: tests cover a
      new character with $500, insufficient funds, a repeated key, two
      simultaneous spends, and the balance shows in the UI after reload.
- [ ] **T16 — Shop catalog (data).** `content/seed/shops.json` validated by Zod
      and seeded into a `shop_items` table: id, name, kind (drink, food,
      clothing), price, shop (cafe, clothes). Owner supplies the list
      (suggested: 4 drinks, 3 foods, 4 clothes). Done when:
      `pnpm content:validate` rejects a missing price or an unknown shop, and
      the server reads the items from the database.
- [ ] **T17 — Order and pay conversation (seller role).** Greet → list the menu
      → player names an item and a quantity (1 to 3) → seller repeats the order
      and total → player confirms → server spends the money → hands over the
      item. Also: ask a price, change or cancel, unknown item, not enough money,
      goodbye. The pending order is server state. Done when: API tests cover a
      full order (balance drops once), cancel, not enough money, a replayed
      confirm, and a Coach correction for "I want buy coffee".
- [ ] **T18 — Station café (two NPCs) and "Your First Coffee".** Café map with a
      cashier (may reuse Mia) and a waiter. The waiter chats and sends orders to
      the cashier. Both point to the receptionist when asked how to leave.
      Update the seeded quest to: greet the cashier → order a drink → confirm
      and pay → reward once. Done when: a signed-in player completes it by
      typing, pays from the balance, gets the reward once, and a refresh keeps
      everything.
- [ ] **T19 — Small-talk pools (scripted).** Global and role-layer topics: how
      are you, weather, feeling tired/fine/sick (a friendly reply only, no
      medical advice), the station, where are you from. 2 or 3 replies per
      topic, with personality styles. Done when: the waiter can chat 5 or more
      turns without the fallback line, with tests for each topic and for unknown
      input.
- [ ] **T20 — Clothes shop (two NPCs) and minimal inventory.** Same pattern as
      the café. Add a small inventory table (user, item, quantity) and a "My
      items" list. Done when: buying a shirt lowers the balance once and the
      item is listed after reload. (Whether clothes change the avatar is an open
      decision.)
- [ ] **T12 — Minimal review screen.** Past corrections and the useful phrases
      the player used in shops ("I'd like…", "How much is…"). Store useful terms
      only, not every word. Done when: after ordering coffee, the screen shows
      the phrase and one correction.
- [ ] **T10 — AI free chat, development provider.** `AiProvider` interface
      (server only), `GeminiProvider` with a free key (fake data only), a mock
      provider for tests, settings in `.env` (`AI_PROVIDER`, `AI_API_KEY`,
      `AI_MODEL`), prompts in one file. SSE streaming, token usage saved,
      free-chat cap and rate limit, scripted fallback on error, timeout or 429.
      AI never changes money, items or quest state. Don't use Gemini-only
      features (for example Google Search grounding). Include a 20-message
      evaluation set and a command that runs it against a chosen provider. Done
      when: text streams word by word, limits work with the mock, the fallback
      works, and switching `AI_PROVIDER` needs no change outside the provider
      class. Production use stays blocked (see Open decisions).
- [ ] **Remaining authored quests** from the existing seed (Mr. Brown, Sam, the
      heater). Add content before any new framework code.
- [ ] **Real phone check (PWA):** Android Chrome and iOS Safari: install,
      reopen, offline `/practice`, keyboard, update confirmation, microphone,
      and performance on a low-end Android with the busiest map.
- [ ] **Playtest build:** HTTPS hosting for the app and the server, a hosted
      Supabase project (migrations, seed, production Auth settings), CORS,
      rate-limit values, and a short privacy note (speech audio may go to the
      browser vendor).

## LATER — only when explicitly requested and policies are decided

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
- AI chat audience and provider: adults 18+ only (paid tier), or a provider that
  allows teens, or no AI chat for minors. The free Gemini quota is for
  development with fake data only (its terms exclude EU/EEA/UK end users and
  apps likely used by under-18s).
- Shops: the item list and prices; what clothes do (only a list, or they change
  the avatar outfit); whether old test characters get a top-up to $500.
- Jobs: light interview only (suggested), or real jobs with pay and work time (a
  big feature, after the MVP).
- XP-to-level thresholds/CEFR promotion, coin spending, energy/free-chat limits.
- General AI/speech providers, production Auth recovery/verification policies,
  audio privacy/age/GDPR and final asset licenses.
- Domain name and hosting for the public site and the game.
- Starter-city expansion and final game name; technical character-name policy.
- Optional improvements: consolidate local vs server-authored dialogue, share
  suitable intent/grammar helpers, useful-vocabulary recording.

D16 cancels native Expo/WebView delivery. Items in LATER are not authority to
implement extra features during the current task.

```

```
