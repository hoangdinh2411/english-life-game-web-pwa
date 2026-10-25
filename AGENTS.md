# Life Abroad — agent instructions

Life Abroad is a web-first English-learning RPG. Work in small, playable slices;
keep code straightforward and responses short. **D16 is current:** the client is
Vite + React + TypeScript + Phaser 4 + PWA, **not** Expo/React Native/WebView.

## Read only what is needed

1. This file and the task the user requested. If only a task ID was given, see
   `docs/TASKS.md`; otherwise do not start a task just because it is listed.
2. `docs/GAME.md` for product behavior or `docs/TECH.md` for interfaces/setup.
3. `apps/game/AGENTS.md` or `apps/server/AGENTS.md` when editing that app.
4. Relevant existing code, tests and schemas. Avoid reading the whole
   repository.
5. Do not use subagents. Do all work in the main thread unless I explicitly ask.
   `docs/GAME.md`, `docs/TECH.md` and `docs/TASKS.md` are the maintained project
   reference; code/schema/content files are the implementation truth. If they
   disagree, verify what exists, note the mismatch and fix documentation when in
   scope. Ask only when a **material, unresolved product decision** blocks the
   task.
6. Large docs: search for the heading you need and read only that section. Never
   read a whole doc.
7. Never read DONE.md unless the user asks.

## Non-negotiable boundaries

- Supabase SDK handles client authentication; NestJS verifies access tokens and
  owns all remote game-data reads/writes. No direct client PostgREST/DB access.
- The server alone changes quests, rewards, XP, coins and any future energy.
  Grants must be transactional and idempotent.
- Author new quest/NPC/scripted dialogue in validated `content/` JSON. Seed it
  into PostgreSQL; cache server dialogue (NPC → role → global). **First planned
  full quest:** station receptionist → bus ticket → Town Street, with server-
  owned progression/rewards. Existing train-station `/practice` is
  **local/offline** and never grants persistent tickets, progress or rewards.
- Organize new client code **by feature** and server code by **NestJS domain
  module**. Keep components/services small and focused; extract shared code only
  after real reuse. `docs/TECH.md` shows placement; app-specific rules live in
  each app's `AGENTS.md`. Migrate old folders only when a task needs it.
- Use the shared semantic color palette for all UI work. In React/Tailwind,
  use the named theme utilities or `var(--color-...)` tokens; do not add
  hard-coded color literals such as `text-[#52644f]`, `bg-[#...]`, or
  `border-[#...]` in components. For Phaser, canvas, PWA metadata, and other
  non-CSS consumers, use `apps/game/src/styles/colors.ts`. Add a new semantic
  token there and in `src/styles.css` when a genuinely new role is needed.
  Literal color values are allowed only in those token definition files or
  when required by external data/asset formats.
- Keep general game rules/contracts in `packages/shared` when reusable, outside
  Phaser scenes. AI providers/keys, when implemented, stay behind a server-only
  interface and are mocked in tests.
- Keep private data and tokens out of service-worker caches, logs and Git. Never
  edit applied migrations; add forward migrations instead.
- Don't introduce native apps, monetization, multiplayer, new libraries, cloud
  services or undecided mechanics without an explicit task/decision.

## Work loop

1. **Branch:** before changing files for a new task, create and switch to a
   suitably named branch. Never implement a task directly on `dev` or `main`.
   The user owns merging completed work into those branches.
2. **Scope:** inspect the relevant implementation; reuse code and existing
   files.
3. **Discuss:** resolve material product or architecture decisions with the user
   before implementation. Do not block clear, low-risk tasks on unnecessary
   confirmation.
4. **Change:** make the smallest coherent change. Add files only when needed for
   working code, tests, migrations or required assets. **Do not generate plans,
   progress logs, reports or extra documentation by default.**
5. **Verify:** run focused checks for the affected area and TypeScript checks;
   run broader lint, tests, content validation or build when the change warrants
   them. Never claim unrun or skipped tests passed. The user owns browser and
   physical-device verification; do not claim those checks were performed.
   When backend behavior is complex or impractical to verify through the client,
   the AI should verify it directly with safe automated, API or integration
   checks when the required infrastructure is available. Report exactly what was
   exercised and leave only genuinely manual checks to the user.
6. **Reply briefly:** what changed, checks with pass/fail/not run, blockers, and
   a focused user-testing checklist split into **Client** and **Backend/API**.
   For every applicable test, state its **Precondition**, exact **Input/Action**
   and observable **Expected output**; omit only fields that genuinely do not
   apply. Write **Not applicable** when the task does not affect one side.
   Client items cover relevant browser/UI flows; backend items cover relevant
   API responses, authorization, validation and persisted state. Mark backend
   cases already verified by the AI as such; don't ask the user to repeat them
   through the client unless an end-to-end observation is still valuable. Don't
   repeat the rest of this template mechanically or write a separate report
   file.

Create a task branch automatically, but don't automatically commit, push, merge,
reset databases, or start the next task. Don't enforce a new Codex session per
task. Update one of the three maintained docs **only** if a durable behavior,
interface, decision or priority actually changed; don't duplicate details across
documents.

## Root commands (run from repo root)

`pnpm dev` · `pnpm dev:game` · `pnpm dev:server` · `pnpm typecheck` ·
`pnpm lint` · `pnpm test` · `pnpm content:validate` · `pnpm build` ·
`pnpm check:pwa` · `pnpm test:integration` (requires local Supabase). For setup,
migrations and other commands see `docs/TECH.md`.
