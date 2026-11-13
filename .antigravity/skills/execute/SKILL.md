---
name: execute
description:
  Executes the task card prepared in .antigravity/current-task.md following the
  sequential pipeline (coder -> reviewer), project boundaries, and verification rules.
  Use when the user invokes /execute or asks to implement/execute the prepared task.
---

# Execute Skill

Execute the task card defined in `.antigravity/current-task.md` safely and rigorously.

## Environment & Test Parameters

- **Dev Servers:** Do NOT start dev servers (client or backend) in the agent session. Servers are already running in the user's external terminal.
- **Client URL:** `http://localhost:8082`
- **Backend URL:** `http://localhost:3000`
- **Database (Supabase):** `https://wedjinchhlybabstcchp.supabase.co`
- **Fixed Test Account:** `test@gmail.com` / `12341234` (Always reuse this existing account; never create a new test user).
- **Git Commits:** Never create git commits, tags, branches merges, or pushes. The user owns git commits. Always suggest a commit message at the end.

## Steps

1. **Read Task Card:** Read `.antigravity/current-task.md` to load the task ID, target files, and approved action steps.
2. **Git Guardian Check:** Run `git branch --show-current`. If on `main`, `master`, or `dev`, automatically create and switch to a new branch `feat/<task-name>` (branched from `dev`). Never work directly on `main`, `master`, or `dev`.
3. **Execute Implementation:**
   - Modify only the target files required by the action steps.
   - Keep changes minimal, coherent, and maintainable.
   - Respect non-negotiable boundaries from `AGENTS.md` (auth, server-owned progression, semantic styling tokens, client/server boundaries).
4. **Verification & Acceptance Checks:**
   - Run `pnpm typecheck` and any task-relevant validations (e.g., `pnpm test`, `pnpm content:validate`, integration tests).
   - If UI/API testing is required, test using the fixed credentials (`test@gmail.com` / `12341234`) on `http://localhost:8082` / `http://localhost:3000`.
   - Inspect `git diff` to confirm zero unintended modifications or scope creep.
5. **Update Status & Report:**
   - If all acceptance criteria pass, mark the completed slice as `[x]` in `docs/TASKS.md`.
   - Output a concise report using the standard format from `docs/MASTER_PROMPT.md`:
     - **Task**
     - **Implemented**
     - **Files**
     - **Verification**
     - **User Testing Checklist** (Client & Backend/API checklists)
     - **Status**
     - **Suggested Commit Message**
   - Stop and wait for user confirmation.
