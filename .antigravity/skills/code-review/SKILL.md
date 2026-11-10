---
name: code-review
description:
  Reviews uncommitted code changes against AGENTS.md rules and runs a typecheck.
  Use when the user types /review, or asks to review, check, or audit recent
  changes, especially code written by Copilot.
---

# Code Review Skill

## Steps

1. **Get the changes.** Run `git diff HEAD` to capture all staged and unstaged
   uncommitted changes. If the output is empty, tell the user "No changes to
   review." and stop.

2. **Check the project rules.** Read `AGENTS.md` in the project root if present.
   Compare each changed file against the defined rules (focusing on
   client/server boundaries, semantic UI patterns, and naming conventions). If
   the diff is very large, review it file by file.

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
