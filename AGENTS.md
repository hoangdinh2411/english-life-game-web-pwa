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
- Keep general game rules/contracts in `packages/shared` when reusable, outside
  Phaser scenes. AI providers/keys, when implemented, stay behind a server-only
  interface and are mocked in tests.
- Keep private data and tokens out of service-worker caches, logs and Git. Never
  edit applied migrations; add forward migrations instead.
- Don't introduce native apps, monetization, multiplayer, new libraries, cloud
  services or undecided mechanics without an explicit task/decision.

## Work loop

1. **Scope:** inspect the relevant implementation; reuse code and existing
   files.
2. **Change:** make the smallest coherent change. Add files only when needed for
   working code, tests, migrations or required assets. **Do not generate plans,
   progress logs, reports or extra documentation by default.**
3. **Verify:** run focused checks for the affected area; run broader typecheck,
   lint, tests, content validation or build when the change warrants them. Never
   claim unrun or skipped tests passed. UI/device claims need real evidence.
4. **Reply briefly:** what changed, checks with pass/fail/not run, blockers.
   Don't repeat this template mechanically or write a separate report file.

Don't automatically create branches, commit, push, merge, reset databases, or
start the next task. Don't enforce a new Codex session per task. Update one of
the three maintained docs **only** if a durable behavior, interface, decision or
priority actually changed; don't duplicate details across documents.

## Root commands (run from repo root)

`pnpm dev` · `pnpm dev:game` · `pnpm dev:server` · `pnpm typecheck` ·
`pnpm lint` · `pnpm test` · `pnpm content:validate` · `pnpm build` ·
`pnpm check:pwa` · `pnpm test:integration` (requires local Supabase). For setup,
migrations and other commands see `docs/TECH.md`.
