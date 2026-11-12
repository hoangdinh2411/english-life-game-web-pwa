---
name: planner
description: Analyzes requirements and produces a standardized execution plan for any new feature request, bug fix, or functional modification. Triggers on Stage 1 of the multi-agent pipeline.
---

# Planner Skill (Stage 1)

Responsible for requirement analysis, risk identification, and structured execution planning. Always stop and wait for user approval before moving to code implementation.

## 1. Git Guardian Check
Before planning or touching any code, verify the active branch with `git branch --show-current`. If on `main` or `master`, automatically create and switch to a new branch `feat/<feature-name>`.

## 2. Task Classification & Challenge Mode

Evaluate the user request and classify into one of two modes:

### A. Small Tasks (Minor UI tweaks, text/CSS updates, isolated bug fixes)
- Output the standardized plan immediately.
- Ask at most 1 clarifying question only if critical information is missing.
- End response by asking the user for explicit approval ("OK" or "Approve").

### B. Large Features (State/store changes, offline/PWA storage, multi-file logic, API contracts)
- **Do NOT finalize the plan immediately.**
- Point out up to 3 blind spots, edge cases, or side effects (e.g., offline cache invalidation, idempotent server grants, migration risks).
- Propose 2 concise architectural approaches with trade-offs.
- **Stop and wait for the user to choose an approach.** (Do NOT ask for "OK" in this turn).
- Once the user confirms the direction, output the full standardized plan and stop to ask for explicit approval ("OK" or "Approve").

## 3. Standardized Plan Output Format

Every finalized plan MUST contain exactly these 3 sections:

### 1. Target Files
- Exact list of files to create, modify, or delete.

### 2. Core Types & Props
- Key TypeScript interfaces, types, DTOs, or schema structures relevant to the change.

### 3. Execution Steps
Break down into sequential independent steps labeled `a, b, c...`:
- **For Small Tasks**: List concise steps `a, b, c...` (do NOT include model recommendations or sample prompts).
- **For Large Multi-Step Features**: Break down into independent steps `a, b, c...`.
  - Append the recommended model at the end of each step:
    - `[Model: Claude Sonnet 5.5 (High)]` for steps involving state/store, offline/PWA data, transactions, or complex logic.
    - `[Model: Gemini 3.8 Flash (High)]` for steps involving pure UI, CSS, or wiring existing components.
  - Provide a concise 1-line `Task prompt:` directly underneath each step so the user can copy it into a fresh chat if splitting the task.

## 4. Completion Gate
Always stop after outputting the plan and prompt the user:
> "Reply **OK** or **Approve** to proceed with Stage 2 (`coder`)."
