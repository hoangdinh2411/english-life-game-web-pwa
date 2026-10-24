# Player Character Onboarding Implementation Plan

> **For agentic workers:** Use the host's available task-by-task implementation workflow. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a three-step country → character → name onboarding flow whose image-only character choice is persisted and rendered throughout saved gameplay.

**Architecture:** Extend the shared creation contract with an immutable `gender` discriminator, persist it on `characters` in the existing first-run transaction, and return it in `Character`. Keep `/new-game` as one React route with internal step state. Resolve gender to bundled player sheets and portraits at the client asset boundary; local practice keeps the generic asset.

**Tech Stack:** TypeScript, React 19, Tailwind CSS, Phaser 4, NestJS, PostgreSQL/Supabase migrations, Node test runner, Vite PWA.

## Global Constraints

- The visible flow is exactly country, character images, then name; do not show the words `Male` or `Female` in the UI.
- Image-only choices retain accessible names and keyboard focus behavior.
- Gender is required, server-validated, persisted transactionally, and immutable after onboarding.
- Do not add color customization or profile gender editing.
- Preserve dirty-worktree changes, do not start another server, and do not create Git commits.
- Existing characters receive one deterministic compatibility gender in a forward migration.

---

### Task 1: Shared and database gender contract

**Files:**
- Modify: `packages/shared/src/onboarding.ts`
- Modify: `packages/shared/tests/onboarding.test.mjs`
- Create: `apps/server/migrations/035_player_gender.sql`
- Test: `apps/server/src/tests/legacy-clock-cleanup.integration.test.ts` or a focused new migration integration test if isolation is clearer

**Interfaces:**
- Consumes: existing `CreateCharacterRequest`, `Character`, `parseCreateCharacterRequest`
- Produces: `PlayerGender = 'female' | 'male'`; `CreateCharacterRequest.gender`; `Character.gender`; `characters.gender`

- [ ] Add failing parser assertions for both accepted genders, missing/unknown gender, and rejected forged fields.
- [ ] Run `pnpm --filter @life-abroad/shared build && pnpm --filter @life-abroad/shared test`; expect the new gender assertions to fail before implementation.
- [ ] Add the strict union and parser validation. Add migration 035: nullable column, backfill existing rows to `male`, then non-null and check constraint.
- [ ] Add a migration test proving old characters receive `male` and invalid values are rejected.
- [ ] Re-run shared and migration-focused tests; expect zero failures.
- [ ] Review the task diff without committing.

### Task 2: Transactional server persistence and response

**Files:**
- Modify: `apps/server/src/modules/players/players.repository.ts`
- Modify: `apps/server/src/tests/players.test.ts`
- Modify: `apps/server/src/tests/players.integration.test.ts`
- Modify: `apps/server/src/tests/first-run.integration.test.ts`

**Interfaces:**
- Consumes: `CreateCharacterRequest.gender`, `characters.gender`
- Produces: saved and returned `Character.gender`; gender-sensitive idempotent replay

- [ ] Add failing unit/integration assertions: missing gender returns 400; both values persist; same payload replays; changed gender returns 409; failed creation leaves no partial row or grant.
- [ ] Run the focused server tests and record the expected missing-column/shape failures.
- [ ] Include gender in the character insert, existing-character replay comparison, player query, row mapping, and response. Keep the write inside the current transaction and never accept asset IDs.
- [ ] Re-run focused server tests. Run `pnpm --filter server typecheck` and the local onboarding integration command when local Supabase is available.
- [ ] Review the task diff without committing.

### Task 3: Gender-specific player assets and resolver

**Files:**
- Create: `apps/game/assets/runtime/player-male.png`
- Create: `apps/game/assets/runtime/player-female.png`
- Create: `apps/game/assets/runtime/player-male-portrait.png`
- Create: `apps/game/assets/runtime/player-female-portrait.png`
- Create: `apps/game/src/features/appearance/player-assets.ts`
- Modify: `apps/game/src/gameplay/station-assets.ts`
- Modify: `apps/game/src/gameplay/portraits.ts`
- Test: `apps/game/tests/player-assets.test.mjs`

**Interfaces:**
- Consumes: `PlayerGender`
- Produces: `playerAssets(gender): { sheet: string; portrait: string }`

- [ ] Add a failing asset/resolver test for both genders, distinct URLs, 128×192 sheets, 32×48 frames, and present portrait files.
- [ ] Inspect the existing player sheet and portrait, then create visually distinct matching male/female assets while preserving sheet geometry and transparent backgrounds.
- [ ] Implement the exhaustive resolver with no runtime fallback for invalid gender.
- [ ] Run the focused asset test and production game build; expect both to pass and all four images to be emitted.
- [ ] Review the task diff without committing.

### Task 4: Three-step accessible onboarding UI

**Files:**
- Modify: `apps/game/src/app/new-game/index.tsx`
- Modify: `apps/game/src/onboarding/onboarding-state.ts`
- Modify: `apps/game/src/session/session-provider.tsx`
- Modify: `apps/game/tests/onboarding.test.mjs`
- Modify: `apps/game/tests/onboarding-browser.tsx`

**Interfaces:**
- Consumes: `OnboardingDraft` with `countryId`, `gender`, `name`; `playerAssets`
- Produces: one `/new-game` route with internal `'country' | 'character' | 'name'` step state

- [ ] Add failing state/browser assertions for fixed step order, no preselection, blocked forward navigation, Back preservation, image-only visual choices, accessible names, and retained values after submission failure.
- [ ] Run focused onboarding tests and record the expected failures.
- [ ] Split the screen into small country, character, and name step components. Use Back/Continue controls; show progress as `Step 1 of 3` etc.; do not render visible gender words. On the final step submit the complete draft exactly once.
- [ ] Update session validation and request construction so missing gender cannot submit and retry recovery preserves it.
- [ ] Re-run focused tests and `pnpm --filter game typecheck`.
- [ ] Review the task diff without committing.

### Task 5: Saved-game rendering and release verification

**Files:**
- Modify: `apps/game/src/types/gameplay/world.ts`
- Modify: `apps/game/src/gameplay/GameCanvas.tsx`
- Modify: `apps/game/src/gameplay/create-station-game.ts`
- Modify: relevant authenticated screen call sites that construct `GameCanvasProps`
- Modify: `docs/GAME.md`
- Modify: `docs/TECH.md`
- Modify: `docs/TASKS.md`
- Test: relevant gameplay/player asset tests

**Interfaces:**
- Consumes: `Character.gender`, `playerAssets(gender)`
- Produces: gender-correct walking sheet and portrait in authenticated gameplay; generic practice asset unchanged

- [ ] Add failing tests showing authenticated female/male characters select different sheets and portraits while `/practice` remains generic.
- [ ] Thread gender through authenticated game props and preload/select the matching sheet before creating animations. Keep recoloring compatible with either base sheet and clean derived textures on teardown.
- [ ] Run focused gameplay tests, shared/server/game typechecks, lint, content validation, game build, and PWA verification.
- [ ] With the already-running app, verify all three steps and Back behavior using the provided account. Capture 320, 375, and ≥1024 CSS-pixel renders; assert no horizontal overflow, ≥44 px targets, reachable actions, hidden visual gender labels, and correct final character rendering.
- [ ] Mark ONB-01.8 complete only if persistence and UI acceptance criteria pass; otherwise leave it open and record the exact blocker.
- [ ] Review the final diff without committing and suggest a commit message to the user.

## Unresolved Product Decisions

None. The compatibility backfill is `male`, chosen only for existing generic-player continuity; it does not create a user-visible selection or permit later edits.
