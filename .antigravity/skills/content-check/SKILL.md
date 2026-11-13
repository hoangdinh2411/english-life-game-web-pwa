---
name: content-check
description:
  Validates game content JSON files (dialogue trees, NPC catalogs, quests, shop items,
  moods, and station nodes) against their schemas and project constraints.
  Use when the user invokes /content-check, or when modifying files in content/.
---

# Content Check Skill

Validate all authored and seeded game content against shared schemas and project rules.

## Steps

1. **Detect Changes:** Run `git diff --name-only HEAD` focusing on `content/` and `packages/shared/src/dialogue/content/`. If a specific file is targeted, focus on that file.
2. **Run Content Validation:** Execute `pnpm content:validate` in the project root.
3. **Inspect Output:**
   - If the script succeeds with exit code 0: confirm that all dialogue, quests, NPCs, shop items, and station nodes pass schema checks.
   - If errors occur: parse the failure messages (file path, JSON path, error description) and point directly to the misconfigured property.
4. **Report Results:**
   - ✅ **Status:** Pass / Fail.
   - 📋 **Validated Content:** List of checked categories (NPCs, Street NPCs, Quests, Shops, Moods, Dialogue Trees, Station Nodes).
   - 🔴 **Issues Found (if any):** File, invalid property/key, expected schema format, and recommended fix.
