---
name: code-review
description:
  Reviews uncommitted code changes against AGENTS.md rules and runs a typecheck.
  Use when the user types /review, or asks to review, check, or audit recent
  changes, especially code written by Copilot.
---

# Code Review Skill

## Steps

1. **Get the changes (minimal tokens).** Run `git status --short` and `git diff HEAD` to capture staged, unstaged, and new untracked files. If both are empty, tell the user "No changes to review." and stop. Read untracked files only as needed (<=150 lines per read).

2. **Check the project rules.** Compare each changed/new file against `AGENTS.md` (and `apps/game/AGENTS.md` / `apps/server/AGENTS.md` when applicable):
   - Client/server boundaries (no direct PostgREST/DB in client; no client-owned XP/coins/rewards/quests).
   - NestJS `AuthGuard` + `SchemaValidationPipe` and forward-only DB migrations.
   - Semantic color tokens (`var(--color-...)` / `UI_COLORS` — no hex literals in React markup), no `any` or leftover debug logs.
   - No guessed workarounds, unapproved fallbacks, invented values, or out-of-scope edits (flag any unapproved assumption as a 🔴 Critical Issue for owner review).
   - Core product features preserved and tested when touching dialogue/NPC/AI/UI: **subtle English error correction** (implicit recast without announcing corrections + `<GrammarFeedbackTag />` in adult mode), **dual-mode (`kid` / `adult`)** compatibility, and **venue hours** (airports/station 24/7; shops scheduled).
   - If the diff is large, review it file by file without re-reading unchanged files.

3. **Run the typecheck.** Run `pnpm typecheck` in the terminal. If pnpm is not
   present, fall back to `npm run typecheck`. Capture any type or build
   compilation errors.

4. **Write the report.** Format the output using the following sections. Skip
   any section that has no findings.
   - 🔴 **Critical Issues**: Type errors, architectural violations.
   - ⚠️ **Warnings**: Rule violations from `AGENTS.md`, code smells, performance
     risks.
   - 💡 **Suggested Fixes**: Short code snippets with file names and line
     numbers included.
   - ✅ If there are no issues found across all checks, output "Looks good!" and
     stop.

## Rules

- Do not edit any file. Only review and report.
