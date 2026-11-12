# Life Abroad — Antigravity Agent Instructions

Web-first English-learning RPG (D16). Keep slices small, code simple, responses concise.
Client: Vite + React + TS + Phaser 4 + PWA (no Expo/React Native/WebView). Main thread only.

## Non-negotiable Boundaries
- **Auth & Data**: Supabase SDK authenticates client; NestJS verifies tokens and owns all remote game data. No direct client PostgREST/DB access.
- **Progression**: Server alone mutates quests, rewards, XP, and coins (transactional & idempotent). Station `/practice` is offline/local without persistent grants.
- **Content**: Author dialogue in validated `content/` JSON, seeded to PostgreSQL.
- **Structure**: Client code is feature-first (`src/features/<feature>`); server is domain modules (`src/modules/<domain>`). Shared contracts live in `packages/shared`.
- **Palette**: Use shared semantic tokens (`var(--color-...)`, `src/styles/colors.ts`); no hex color literals in React markup.
- **Hygiene**: No secrets or private tokens in Git/logs/bundles. Forward-only DB migrations.

## Work Loop
1. **Branch**: Create/switch to a task branch before edits; never work directly on `dev`/`main`.
2. **Scope**: Inspect existing files; reuse code; ask only on material product/architecture blockers.
3. **Change**: Minimal coherent change. No plans, progress logs, or extra docs by default.
4. **Verify**: Run focused checks (typecheck, lint, affected tests). Never claim unrun tests passed.
5. **Reply**: State changes, check status (pass/fail/not run), and a focused user-testing checklist split into Client and Backend/API (Precondition, Input/Action, Expected output).

## Root Commands
`pnpm dev` · `pnpm dev:game` · `pnpm dev:server` · `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm content:validate` · `pnpm build` · `pnpm check:pwa` · `pnpm test:integration`
