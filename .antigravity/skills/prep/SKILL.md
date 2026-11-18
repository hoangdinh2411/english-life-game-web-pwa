---
name: prep
description:
  Look up a task in docs/TASKS.md, audit existing code/contracts for gaps,
  split multi-layer work into single-layer steps, recommend the optimal 3-tier
  AI model, write .antigravity/current-task.md, and output the plan in chat.
---

When the user invokes `/prep` (with a task ID, task name, or asking for the next
pending task):

1. **Read task & rules (minimal tokens):**
   - Read only the relevant section of `docs/TASKS.md` and `docs/MASTER_PROMPT.md` §1–§4.
   - Never read `docs/DONE.md`. Never read `docs/art-direction/` unless the task creates/edits/uploads art or audio assets.
2. **Pre-Flight Code & Contract Audit (do NOT edit source code):**
   - Search with targeted patterns (`Select-String` / `rg`) first; read only relevant functions/lines (<=150 lines per read).
   - **Check already-done work:** Verify whether migrations, schemas, endpoints, or tests already exist (e.g. `supabase/migrations/`, `packages/shared/`, `apps/*/src/tests/`). Never plan duplicate work.
   - **Check cross-layer gaps:** Verify every schema (`packages/shared`), DB column, API route, and config/registry (`venue-npc-config.ts`, `player-location.ts`, `job-registry.ts`, etc.) required by the task actually exists and matches.
   - **No-Guessing & Owner Review Gate:** If ANY requirement, contract, schema, DB column, endpoint, or coordinate is missing, unclear, or conflicts with existing code/tests, **do NOT guess or invent a workaround**. Stop before writing `.antigravity/current-task.md`, do NOT touch any source file, list every concrete issue (file path, symbol/line, conflict, and options) for the user to review and approve, and wait.
   - **Enforce single-layer scope:** Keep the task to 1–4 target files in a single layer (Shared/Server OR Client UI OR Phaser Scene OR Tests). If a task spans multiple layers, recommend splitting it into sub-slices before execution.
3. **Recommend model (3-tier matrix — pick the lightest tier that succeeds):**
   - **`Gemini Flash` (Tier 1 — Light):** Pure React UI/CSS (`var(--color-...)`), minigame engines matching `JobTicket`/`JobShiftReport`, static `content/` JSON, small config/test/doc updates, verification-only tasks.
   - **`Gemini Hydrogen` (Tier 2 — Mid):** Multi-file feature wiring following existing patterns, React state + API hooks, NestJS endpoints/repositories using existing guards/transactions, Phaser scene integration with clear coordinates/contracts, integration tests, CLI scripts, doc refactors.
   - **`Claude Sonnet` (Tier 3 — Heavy, exception only):** Greenfield core architecture with no repo precedent, complex DB concurrency/locking bugs, audio worklet/PWA offline sync edge cases, or tasks that failed twice in Tier 1/2.
4. **Write `.antigravity/current-task.md` (max 24 lines, dense & self-contained):**
   Include exact target files/line hints, concrete contract details (endpoint paths, schema names, coordinates, prop types), and scope boundaries so `execute` can run in a fresh cheap chat without re-scanning the codebase.
5. **Stop & Output:** Do NOT edit any source code. Output the execution card written to `.antigravity/current-task.md` followed by Mentor Notes & Critical Risks using this exact template:

```markdown
### Task: [Task ID & Name]

- **Recommended Model:** [Gemini Flash | Gemini Hydrogen | Claude Sonnet] — [1-line reason]
- **Target Files:**
  - `path/to/file1` (`symbol` / lines)
  - `path/to/file2` (`symbol` / lines)
- **Contract & Existing Assets:** [Exact schemas/endpoints/migrations/configs already verified or missing]
- **Action Steps:**
  1. [Single-layer step 1]
  2. [Single-layer step 2]

---
### ⚠️ Mentor Notes & Critical Risks
- **Pre-Flight Check:** [Already-implemented pieces or contract gaps discovered in repo]
- **Scope Boundary:** [What must NOT be touched or expanded in this task]
- **Trap / Overengineering:** [Technical pitfalls or overengineering traps to avoid]
- **Key Verification:** [Exact command(s) and core acceptance checks to prove]
```
