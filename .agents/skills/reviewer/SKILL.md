---
name: reviewer
description: Validates implementation using git diff, typecheck and acceptance checks, and exchanges findings with the coder (up to 3 rounds), keeping the user informed. Triggers automatically on Stage 3 of the multi-agent pipeline right after coder completes, in every mode.
---

# Reviewer Skill (Stage 3)

Responsible for automated quality gate verification, coder feedback, and user-facing change reporting. **Mandatory and automatic** right after Stage 2 (`coder`) finishes, in both Interactive and Task-driven modes. The reviewer never edits code; only the `coder` does.

## Rules & Verification Steps

1. **Inspect Git Diff**:
   - Run `git diff` (staged and unstaged, plus new untracked files) to inspect all modifications.
   - Check for type errors, unused imports, leftover debug logs, stray scratch files (e.g. `.probe.mjs`), or logic flaws.
   - Ensure changes strictly follow the approved plan and adhere to `AGENTS.md` boundaries (no hex colors in React markup, correct client/server separation).

2. **Run Checks**:
   - Always: `pnpm typecheck`.
   - When relevant to the task (per `docs/MASTER_PROMPT.md` §6): `pnpm lint`, focused tests (`pnpm test`, `pnpm test:integration`), `pnpm content:validate`, and verification of the task's acceptance criteria.
   - Do not start servers if the user said they are already running.

3. **Coder ↔ Reviewer Exchange (max 3 rounds)**:
   - If any check or the diff review reveals problems, send the coder a message to the user-visible log:
     `Round N — Reviewer → Coder`: each issue as file, line, error/rule, suggested fix.
   - The coder fixes and replies `Round N — Coder → Reviewer` (what changed, or why it disagrees).
   - Re-run the failing checks and re-inspect the diff. Repeat up to 3 rounds.
   - If errors remain after round 3, halt and clearly report the blocking issues to the user.

4. **Reporting Completion**:
   - Report **ONLY** after all required checks pass with 0 errors (or after halting per step 3).
   - Use the `docs/MASTER_PROMPT.md` §8 format (Task / Implemented / Files / Verification / User testing checklist / Status / Notes), and add:
     - **Coder ↔ Reviewer log**: the rounds above, or "No issues found" if the first review was clean.
     - **Verification Status**: each command actually run and its result (pass/fail/not run). Never claim an unrun check passed.
     - **Focused User-Testing Checklist**:
       - **Client**: Precondition, Input/Action, Expected output.
       - **Backend/API** (if applicable): Precondition, Input/Action, Expected output.
     - A suggested commit message (the user commits manually).
