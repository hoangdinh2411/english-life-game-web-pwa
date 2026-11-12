# Migration Plan: Codex to Google Antigravity

This document outlines the transition of the **Life Abroad** codebase from OpenAI Codex to Google Antigravity.

---

## Task 1: Complete Transition and Harmonize Environment for Antigravity

### Sub-step a: Clean up legacy Codex artifacts and synchronize agent guidance [COMPLETED]
- [x] Verified no hidden legacy Codex directories or files (`.codex/`, `.copilot/`, etc.) remain in the workspace.
- [x] Streamlined root `AGENTS.md` down to 22 lines (< 50 lines constraint) adhering to Antigravity guidelines.
- [x] Verified sub-app instruction files (`apps/game/AGENTS.md`, `apps/server/AGENTS.md`) align with root `AGENTS.md`.
- [x] Replaced legacy Codex terminology in `docs/TASKS.md` with platform-neutral agent instructions.
- [x] Relocated root `GEMINI.md` to `docs/DESIGN_CONTRACT.md` to eliminate conflicting non-coding persona directives.

### Sub-step b: Harmonize environment templates and runtime configurations [COMPLETED]
- [x] Audited root `.env.example` and `apps/game/.env.example` against actual service requirements.
- [x] Verified `.gitignore` properly excludes all active secrets (`.env`, `.env.local`, `.voice-cache/`, `apps/server/.env.supabase.local`).
- [x] Validated Node.js v22.23.2 runtime location and execution path on Windows.

### Sub-step c: Execute baseline health check and pipeline validation [COMPLETED]
- [x] `pnpm typecheck`: Passed across `@life-abroad/shared`, `apps/game`, and `apps/server`.
- [x] `pnpm lint`: Passed cleanly across all files with zero ESLint warnings or errors.
- [x] `pnpm content:validate`: Passed (247 countries, NPCs, quests, shop items, dialogue validated).
- [x] `pnpm test`: Passed (all 155+ unit and integration test assertions passed, 0 failures).
- [x] `pnpm build`: Passed (production client bundle, service worker PWA injection, and server compilation).

---

## Review & Approval Status
- **Status:** COMPLETED & VERIFIED
- **All sub-steps (a, b, c) have been executed and verified.**
