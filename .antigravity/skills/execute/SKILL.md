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

1. **Read Task Card (token-efficient):** Read `.antigravity/current-task.md` first. Read ONLY the target files and symbol/line ranges listed on the card (for files >200 lines such as `create-station-game.ts` or `StationScreen.tsx`, locate symbols via search and read only the needed blocks). Never read `docs/DONE.md` or unrelated `docs/` files.
2. **Git Guardian Check:** Run `git branch --show-current`. If on `main`, `master`, or `dev`, automatically create and switch to a new branch `feat/<task-name>` (branched from `dev`). Never work directly on `main`, `master`, or `dev`.
3. **No-Guessing Contract Gate (Stop for Owner Review):** Before editing any file, confirm the card's requirements and contracts (`packages/shared`, DB columns, endpoints, props, coordinates) clearly match the actual files read. If ANYTHING is unclear, missing, or contradictory—or would require guessing a workaround, inventing unapproved behavior, or editing out-of-scope files—**STOP immediately with zero file edits**. List every concrete issue (file path, symbol/line, exact gap or conflict) in chat for the user to review and approve before proceeding.
4. **Execute Implementation (`coder` stage):**
   - Modify only the target files required by the action steps (plus directly related tests).
   - Keep changes minimal, coherent, and maintainable.
   - Respect non-negotiable boundaries from `AGENTS.md` (auth, server-owned progression, semantic `var(--color-...)` / `UI_COLORS` styling tokens, client/server boundaries).
5. **Verification & Review (`reviewer` stage — mandatory):**
   - Run `pnpm typecheck` and any task-relevant validations listed on the card (`pnpm test`, `pnpm lint`, integration tests).
   - **Auto Content Check:** If any file under `content/` or `packages/shared/src/dialogue/content/` (or content schemas) was modified, automatically run `pnpm content:validate` (`content-check`).
   - If UI/API testing is required, test using the fixed credentials (`test@gmail.com` / `12341234`) on `http://localhost:8082` / `http://localhost:3000`.
   - Inspect `git diff` to confirm zero unintended modifications, hex literals in React markup, or scope creep (up to 3 reviewer↔coder rounds if issues are found).
6. **Update Status & Report:**
   - If all acceptance criteria pass:
     1. **Sub-task / slice (task nhỏ):** Mark the completed slice as `[x]` in `docs/TASKS.md` and update the `Done:` summary line at the top of `docs/TASKS.md`. Keep the slice in `docs/TASKS.md` while its parent task still has unfinished slices.
     2. **Parent task (task to):** Only when **all** child slices of a parent task (or a standalone task) are `[x]`, remove the entire parent task block from `docs/TASKS.md` and append the completed entries to `docs/DONE.md` (`- <ID> | <title> | YYYY-MM-DD | <one-line result>`).
   - Output a concise report using the standard format from `docs/MASTER_PROMPT.md`:
     - **Task**
     - **Implemented**
     - **Files**
     - **Verification**
     - **User Testing Checklist** (Client & Backend/API checklists)
     - **Status**
     - **Suggested Commit Message**
   - Stop and wait for user confirmation.
