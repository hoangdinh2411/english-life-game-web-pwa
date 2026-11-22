---
name: planner
description: Analyzes requirements and produces a standardized execution plan for any new feature request, bug fix, or functional modification. Triggers on Stage 1 of the multi-agent pipeline.
---

# Planner Skill (Stage 1)

Responsible for requirement analysis, risk identification, and structured execution planning. Always stop and wait for user approval before moving to code implementation.

## 1. Git Guardian Check
Before planning or touching any code, verify the active branch with `git branch --show-current`. If on `main`, `master`, or `dev`, automatically create and switch to a new branch `feat/<feature-name>` (from `dev`).

## 2. Task Classification, Contract Audit & Challenge Mode

Before planning, run a fast **Repo & Contract Audit** (search first, read only relevant line ranges; never read `docs/DONE.md`):
- Check whether migrations, schemas, endpoints, or tests already exist so you never plan duplicate work.
- Verify `packages/shared` schemas, DB columns, API endpoints, and registry/coordinate configs (`venue-npc-config.ts`, `player-location.ts`, etc.) match the request.
- **Core Product Features Check:** When planning dialogue, NPC, UI, or progression work, explicitly preserve and integrate core learning/gameplay features: **subtle English error correction** (implicit recast in NPC replies without announcing corrections + `<GrammarFeedbackTag />` in adult mode), **dual-mode (`kid` / `adult`)** compatibility, **venue hours** (24/7 airport/station vs scheduled shops), and **offline `/practice` isolation**.
- **No-Guessing & Owner Review Gate:** If anything is unclear, missing, or conflicts with existing code/contracts (and cannot be verified directly from approved repo code), **do NOT guess, assume, or silently invent a workaround**. Stop and list every concrete issue (file path, symbol/line, conflict, and options) for the user to review and approve before finalizing any plan or touching files.
- Slice multi-layer work into independent **single-layer steps** (Shared/Server contract, Client UI, Phaser scene wiring, Integration tests) with <= 4 files per step so Tier 1/2 models can execute each step in a small context.

Evaluate the user request and classify into one of two modes:

### A. Small Tasks (Minor UI tweaks, text/CSS updates, isolated single-layer fixes)
- Output the standardized plan immediately.
- Ask at most 1 clarifying question only if critical information is missing.
- End response by asking the user for explicit approval ("OK" or "Approve").

### B. Large Features (State/store changes, offline/PWA storage, multi-file logic, API contracts)
- **Do NOT finalize the plan immediately.**
- Point out up to 3 blind spots, missing contracts, or side effects (e.g., schema vs DB mismatches, offline cache invalidation, idempotent server grants, migration risks).
- Propose 2 concise architectural approaches with trade-offs.
- **Stop and wait for the user to choose an approach.** (Do NOT ask for "OK" in this turn).
- Once the user confirms the direction, output the full standardized plan and stop to ask for explicit approval ("OK" or "Approve").

## 3. Standardized Plan Output Format

Every finalized plan MUST contain exactly these 3 sections:

### 1. Target Files
- Exact list of files to create, modify, or delete (with symbol/line hints for files >200 lines).

### 2. Core Types & Props
- Key TypeScript interfaces, Zod schemas, endpoints, or SQL columns relevant to the change (explicitly note what already exists vs what is added).

### 3. Execution Steps
Break down into sequential, single-layer independent steps labeled `a, b, c...`:
- **For Small Tasks**: List concise steps `a, b, c...` (do NOT include model recommendations or sample prompts).
- **For Large Multi-Step Features**: Break down into single-layer steps `a, b, c...` (<= 4 files per step).
  - Append the lightest eligible model tier at the end of each step:
    - `[Model: Gemini Flash]` — Pure UI/CSS (`var(--color-...)`), minigame engines following `JobTicket`, static `content/` JSON, small config/test/doc edits.
    - `[Model: Gemini Hydrogen]` — Multi-file feature wiring using existing patterns, React state + API hooks, NestJS endpoints/repositories using existing guards/transactions, Phaser scene integration, integration tests, CLI scripts.
    - `[Model: Claude Sonnet — Exception only]` — Greenfield core architecture with no precedent, complex DB concurrency/locking, or audio worklet/PWA offline sync edge cases.
  - Provide a concise 1-line `Task prompt:` directly underneath each step (including exact target files & contract) so the user can paste it into a fresh chat with minimal token cost.

## 4. Completion Gate
Check the mode defined in the root `AGENTS.md`:
- **Interactive mode (default)**: stop after the plan and prompt the user:
  > "Reply **OK** or **Approve** to proceed with Stage 2 (`coder`)."
- **Task-driven mode** (prompt references `docs/MASTER_PROMPT.md` and/or a task ID): the prompt is the approval. Output the brief plan, do **not** stop, and continue to Stage 2 (`coder`). Skip Challenge Mode's "wait for approach choice" **only** when contracts and requirements are unambiguous; if anything is unclear, missing, or conflicts with existing code, **do NOT guess** — stop, list every concrete issue for owner review, and wait.
