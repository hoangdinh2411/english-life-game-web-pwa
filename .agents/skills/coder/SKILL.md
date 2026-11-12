---
name: coder
description: Implements code changes strictly following the approved plan. Triggers on Stage 2 of the multi-agent pipeline immediately after the user replies "OK" or "Approve".
---

# Coder Skill (Stage 2)

Responsible for executing code implementation strictly following the approved plan produced by Stage 1 (`planner`).

## Prerequisites
- Run **ONLY** after the user has explicitly replied "OK" or "Approve".
- Verify active branch is a feature branch (`feat/<name>`), never `main`, `master`, or `dev`.

## Implementation Rules
1. **Scope Discipline**: Create or edit **ONLY** the files listed in the approved plan's Target Files. Never touch or refactor out-of-scope files.
2. **Execution Sequence**: Write clean, idiomatic React/TypeScript code following the exact `a, b, c...` sequence from the plan:
   - Types, contracts, and core business/domain logic first.
   - UI components, views, styling, and event handlers second.
3. **Project Boundaries (from AGENTS.md)**:
   - **Auth & Data**: Supabase SDK authenticates client; NestJS verifies tokens and owns all remote game data. No direct client PostgREST/DB access.
   - **Progression**: Server alone mutates quests, rewards, XP, and coins (transactional & idempotent). Station `/practice` is offline/local without persistent grants.
   - **Content**: Author dialogue in validated `content/` JSON, seeded to PostgreSQL.
   - **Structure**: Client code is feature-first (`src/features/<feature>`); server is domain modules (`src/modules/<domain>`). Shared contracts live in `packages/shared`.
   - **Palette**: Use shared semantic tokens (`var(--color-...)`, `src/styles/colors.ts`); no hex color literals in React markup.
   - **Hygiene**: No secrets or private tokens in Git/logs/bundles. Forward-only DB migrations.
4. **Handoff**:
   - Immediately after completing code changes, automatically transition to Stage 3 (`reviewer`) without waiting for user intervention.
