---
name: coder
description: Implements code changes strictly following the approved plan and fixes issues raised by the reviewer. Triggers on Stage 2 of the multi-agent pipeline after plan approval (user replies "OK"/"Approve" in Interactive mode, or immediately in Task-driven mode).
---

# Coder Skill (Stage 2)

Responsible for executing code implementation strictly following the approved plan produced by Stage 1 (`planner`), and for fixing issues the `reviewer` reports.

## Prerequisites
- Run only after plan approval: the user's explicit "OK"/"Approve" (Interactive mode) or the task-driven prompt itself (Task-driven mode), as defined in the root `AGENTS.md`.
- Verify active branch is a feature branch (`feat/<name>`), never `main`, `master`, or `dev`.

## Implementation Rules
1. **Scope Discipline**: Create or edit **ONLY** the files listed in the approved plan's Target Files, plus directly related tests and the task-status docs required by `docs/MASTER_PROMPT.md` §7. Never touch or refactor out-of-scope files.
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
4. **No Git writes**: never commit, tag, merge, push or open PRs. Suggest a commit message in the final report.
5. **Handoff to reviewer (mandatory)**:
   - Immediately after completing code changes, automatically transition to Stage 3 (`reviewer`) without waiting for user intervention. Never skip this step or report completion before the reviewer passes.
   - Do **not** mark the task done in `docs/TASKS.md` / `docs/DONE.md` until the reviewer reports a pass.
6. **Reviewer exchange**: when the `reviewer` sends findings (`Reviewer → Coder`), fix each one (only the coder edits code) and answer with a short `Coder → Reviewer` message: what changed per issue, or a one-line reason if you disagree. This message is shown to the user. Then return control to the reviewer. Maximum 3 rounds.
7. **After reviewer pass**: apply the task-completion updates from `docs/MASTER_PROMPT.md` §7 (remove from `TASKS.md`, append to `DONE.md`, update `Done:` line) only if all acceptance criteria are verified.
