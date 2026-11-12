---
name: reviewer
description: Validates implementation using typecheck and git diff analysis, auto-fixing issues up to 3 loops. Triggers automatically on Stage 3 of the multi-agent pipeline right after coder completes implementation.
---

# Reviewer Skill (Stage 3)

Responsible for automated quality gate verification, error remediation, and user-facing change reporting. Runs automatically right after Stage 2 (`coder`) finishes.

## Rules & Verification Steps

1. **Inspect Git Diff**:
   - Run `git diff` (staged and unstaged) to inspect all modifications.
   - Check for type errors, unused imports, leftover debug logs, or logic flaws.
   - Ensure changes strictly follow the approved plan and adhere to `AGENTS.md` boundaries (no hex colors in React markup, correct client/server separation).

2. **Run Typecheck**:
   - Execute the project typecheck command: `pnpm typecheck`.

3. **Auto-Fix Loop (Max 3 iterations)**:
   - If `pnpm typecheck` or git diff checks reveal errors:
     1. Analyze the exact error output and pinpoint affected files.
     2. Apply targeted fixes.
     3. Re-run `pnpm typecheck`.
     4. Repeat up to a maximum of 3 iterations.
   - If errors still remain after 3 loops, halt and clearly document the remaining blocking issues for the user.

4. **Reporting Completion**:
   - Report a concise summary to the user **ONLY** after `pnpm typecheck` passes with 0 errors.
   - The final output must include:
     - **Summary of Changes**: Concise description of modified files and functionality.
     - **Verification Status**: `pnpm typecheck` (Pass), `git diff` (Clean).
     - **Focused User-Testing Checklist**:
       - **Client**: Precondition, Input/Action, Expected output.
       - **Backend/API** (if applicable): Precondition, Input/Action, Expected output.
