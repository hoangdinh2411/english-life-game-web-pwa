---
name: prep
description:
  Look up a task in docs/TASKS.md, check docs/MASTER_PROMPT.md conventions,
  locate target files, recommend the optimal AI model, write
  .antigravity/current-task.md, and output the full plan in chat.
---

When the user invokes `/prep` (with a task ID, task name, or asking for the next
pending task):

1. **Read context:** Read `docs/TASKS.md` to extract the details of the
   requested task, and read `docs/MASTER_PROMPT.md` for project conventions (do
   NOT implement code yet).
2. **Locate scope:** Search only relevant folders to identify the exact 1–4
   files needed for this task.
3. **Recommend model:** Choose the most cost-effective model:
   - `Gemini Flash` / `GPT Mini`: UI tweaks, CSS/Tailwind, static components,
     simple types.
   - `Claude Sonnet`: Complex React state, game logic, API/PWA offline sync,
     tricky bugs.
4. **Write file:** Save the execution card to `.antigravity/current-task.md`
   (max 14 lines).
5. **Stop & Output:** Do NOT edit any source code. In your chat response, you
   MUST output the markdown execution card written to
   `.antigravity/current-task.md` followed by the Mentor Notes & Critical Risks
   section using the exact template below:

```markdown
### Task: [Task ID & Name]

- **Recommended Model:** [Model Name] — [1-line reason]
- **Target Files:**
  - `path/to/file1`
  - `path/to/file2`
- **Action Steps:**
  1. [Step 1]
  2. [Step 2]

---
### ⚠️ Mentor Notes & Critical Risks
- **Scope Boundary:** [What must NOT be touched or expanded in this task]
- **Trap / Overengineering:** [Technical pitfalls or overengineering traps to avoid]
- **Key Verification:** [Core acceptance checks and critical edge cases to prove]
```
