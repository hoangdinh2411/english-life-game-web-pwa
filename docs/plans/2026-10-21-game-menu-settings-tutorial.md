# Game Menu, Synchronized Settings, and Tutorial Implementation Plan

> **For agentic workers:** Use the host's available task-by-task implementation workflow. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a non-pausing game menu, account-synchronized learning settings, and a five-page illustrated first-run tutorial without interrupting the simulated world.

**Architecture:** Keep Sound in the existing device preference store and add a server-owned preference record for Coach, speech rate, and speech pitch under the players domain. Replace the current menu composition with small feature-owned overlay components; overlays capture player input but do not pause NPC movement or game time. Keep tutorial completion device-local and keep local practice free of authenticated preference API calls.

**Tech Stack:** TypeScript, React 19, Tailwind CSS, Phaser 4, NestJS, Zod shared contracts, PostgreSQL/Supabase migrations, Node test runner.

## Global Constraints

- The game menu, Settings, English Review, and Movement Tutorial must not pause game time, NPC schedules, or NPC movement.
- Overlay controls may capture keyboard/pointer input so menu actions do not also move the player.
- Sound defaults on, remains device-local, and does not attempt to read system volume.
- Coach, speech rate (`0.75–1.5`), and speech pitch (`0.75–1.25`) synchronize through authenticated NestJS endpoints; the client never accesses PostgreSQL directly.
- Local practice uses device-local preferences and makes no preferences API calls.
- `movementTutorialSeen` remains device-local. First run opens automatically; Skip and Start Exploring mark it seen. Reopening from the menu starts at page one.
- Preserve current dialogue, loading, offline, and sleep-transition pause behavior.
- Implement and verify only one numbered task per request. Do not start the next task automatically and do not commit unless the user requests it.

---

### Task 1: Persist synchronized learning preferences

**Files:**
- Create: `apps/server/migrations/031_player_preferences.sql`
- Create: `packages/shared/src/player-preferences.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/server/src/modules/players/players.controller.ts`
- Modify: `apps/server/src/modules/players/players.service.ts`
- Modify: `apps/server/src/modules/players/players.repository.ts`
- Create: `apps/server/src/tests/player-preferences.test.ts`
- Modify: `apps/server/src/tests/database.integration.test.ts`

**Interfaces:**
- Produces `PlayerPreferences`, `PlayerPreferencesUpdate`, `playerPreferencesSchema`, and `playerPreferencesUpdateSchema`.
- Produces authenticated `GET /players/preferences` and `POST /players/preferences` operations.
- The GET response distinguishes a missing preference row from stored defaults so legacy client settings can initialize an account exactly once.

- [ ] Add failing contract tests for valid defaults, partial updates, unknown keys, non-booleans, non-finite values, and both numeric bounds.
- [ ] Add migration `031_player_preferences.sql`: one row per `profiles.id`, cascade delete, checked numeric ranges, `updated_at`, RLS enabled, and no direct authenticated/anon policy.
- [ ] Add repository read, atomic create-if-absent, and partial update methods. Create-if-absent must return the existing row when two devices race.
- [ ] Add service/controller methods guarded by the existing `AuthGuard` and validated by `SchemaValidationPipe`.
- [ ] Test ownership, missing-row initialization, concurrent initialization, partial updates, bounds rejection, cascade deletion, and direct-role denial.
- [ ] Run `pnpm --filter @life-abroad/shared build`, `pnpm --filter server typecheck`, and the focused server test. Run `pnpm test:integration` only when local Supabase is available; report it as not run otherwise.
- [ ] Stop and report Task 1. Do not begin Task 2.

### Task 2: Add client preference synchronization

**Files:**
- Modify: `apps/game/src/api/client.ts`
- Modify: `apps/game/src/features/hud/preferences.ts`
- Modify: `apps/game/src/features/hud/usePreferences.ts`
- Create: `apps/game/src/features/hud/synced-preferences.ts`
- Modify: `apps/game/src/session/session-provider.tsx`
- Create: `apps/game/tests/synced-preferences.test.mjs`
- Modify: `apps/game/tests/hud-preferences.test.mjs`

**Interfaces:**
- Consumes the Task 1 preference schemas and endpoints.
- Produces a preference state with `status: 'local' | 'loading' | 'saved' | 'saving' | 'error'`, `retry()`, and the existing typed `set()` behavior.

- [ ] Add failing tests for Sound-only local persistence, authenticated loading, legacy initialization, server-wins merge, local practice isolation, immediate Coach save, debounced slider save, latest-value-wins, failed save status, and Retry.
- [ ] Split device Sound persistence from account learning preferences without changing existing callers' value names.
- [ ] Add parsed API functions for read and partial update. Keep `cache: 'no-store'` and authenticated NestJS routing.
- [ ] Load synchronized preferences after authenticated session restoration. Do not block map startup on a slow preferences request.
- [ ] Update slider values immediately, debounce network writes, cancel stale writes, and prevent an older response from overwriting a newer local value.
- [ ] On failure, retain the usable in-memory value, expose a visible unsynchronized state, and retry the latest desired value only when requested.
- [ ] Run the focused preference tests and `pnpm --filter game typecheck`.
- [ ] Stop and report Task 2. Do not begin Task 3.

### Task 3: Build the non-pausing game menu shell

**Files:**
- Create: `apps/game/src/features/game-menu/GameMenu.tsx`
- Create: `apps/game/src/features/game-menu/game-menu-state.ts`
- Modify: `apps/game/src/gameplay/StationScreen.tsx`
- Create: `apps/game/tests/game-menu.test.mjs`

**Interfaces:**
- Produces menu actions for English Review, Movement Tutorial, Sign Out/Leave Local Practice, Return to Game, Settings, and the existing update action when available.
- Produces an explicit overlay/input state that passes `paused=true` to capture player input and `worldPaused=false` to keep simulation running, using the existing `GameCanvas` contract.

- [ ] Add failing tests proving the five required actions and practice labels, close/focus restoration, Escape behavior, and non-pausing state derivation.
- [ ] Extract the menu from `StationScreen` into a focused component styled from the cream, muted-green, and brown-gold UI references.
- [ ] Remove the `Paused` title and stop treating the menu as a pause reason. Keep NPC/world simulation running while preventing menu keystrokes from moving the player.
- [ ] Preserve existing true pause reasons: dialogue, loading, sleep transition, offline state, and server-state blockers.
- [ ] Keep update availability reachable without removing any of the five requested actions.
- [ ] Run the focused test and `pnpm --filter game typecheck`.
- [ ] Stop and report Task 3. Do not begin Task 4.

### Task 4: Move Settings into its own overlay

**Files:**
- Create: `apps/game/src/features/game-menu/SettingsPanel.tsx`
- Modify: `apps/game/src/features/hud/Settings.tsx`
- Modify: `apps/game/src/gameplay/StationScreen.tsx`
- Modify: `apps/game/tests/hud-browser.tsx`
- Create: `apps/game/tests/settings-panel.test.mjs`

**Interfaces:**
- Consumes Task 2 preference state and Task 3 menu navigation callbacks.
- Produces `SettingsPanel({ onBack, practice })` with Sound, Coach, Voice Speed, Voice Pitch, save status, and Retry.

- [ ] Add failing tests for menu-to-Settings navigation, Back returning to the menu, device Sound, synchronized control status, Retry, and practice-mode local behavior.
- [ ] Keep compact dialogue settings working; separate reusable controls from the full Settings overlay without duplicating preference logic.
- [ ] Build a scroll-safe Settings panel with labelled controls, focus restoration, 44px targets, and clear Saving/Not synchronized feedback.
- [ ] Confirm opening Settings does not change world pause state and that slider key input does not move the player.
- [ ] Render-check Settings at 320px, 375px, and desktop width; verify no horizontal overflow and record evidence paths.
- [ ] Run the focused test and `pnpm --filter game typecheck`.
- [ ] Stop and report Task 4. Do not begin Task 5.

### Task 5: Implement the five-page tutorial behavior

**Files:**
- Create: `apps/game/src/features/tutorial/tutorial-pages.ts`
- Create: `apps/game/src/features/tutorial/tutorial-state.ts`
- Move/replace: `apps/game/src/gameplay/TutorialDialogue.tsx` → `apps/game/src/features/tutorial/MovementTutorial.tsx`
- Modify: `apps/game/src/gameplay/StationScreen.tsx`
- Modify: `apps/game/src/types/ui/gameplay.ts`
- Create: `apps/game/tests/movement-tutorial.test.mjs`

**Interfaces:**
- Produces five typed pages: Move Around, Talk and Interact, Follow Your Goals, Practice English, Use the Game Menu.
- Produces `MovementTutorial({ playerName, sound, source, onClose })`, where `source` is `first-run` or `menu` and close returns to the correct surface.

- [ ] Add failing tests for page order/content, `1 / 5` through `5 / 5`, disabled/absent Back on page one, Next, final Start Exploring, Skip, ArrowLeft/ArrowRight, Escape, and form-control key exclusion.
- [ ] Implement small page-state functions independently of React rendering.
- [ ] Keep `movementTutorialSeen`; write `"1"` only on Skip or Start Exploring. Menu reopening always starts at page one.
- [ ] Return a menu-launched tutorial to the game menu; return first-run completion directly to the game.
- [ ] Keep NPC movement and game time active while capturing tutorial navigation input.
- [ ] Run the focused tutorial test and `pnpm --filter game typecheck`.
- [ ] Stop and report Task 5. Do not begin Task 6.

### Task 6: Add illustrations and complete visual/behavior verification

**Files:**
- Create or reuse: `apps/game/public/images/tutorial/*` only for assets actually needed by the five pages.
- Modify: `apps/game/src/features/tutorial/MovementTutorial.tsx`
- Modify: `apps/game/src/features/game-menu/GameMenu.tsx`
- Modify: `docs/GAME.md`
- Modify: `docs/TECH.md`
- Modify: `docs/TASKS.md`

**Interfaces:**
- Consumes the Task 3–5 components and existing runtime/UI assets.
- Produces the finished responsive menu, Settings, and illustrated tutorial flow.

- [ ] Reuse existing sprites/UI motifs where licensing and readability permit; do not add map-wide `?` markers or repurpose quest `!` markers.
- [ ] Give each tutorial page one compact illustration and at most two short explanatory sentences. Include desktop and touch guidance where relevant.
- [ ] Render-check the menu, Settings, pages 1 and 5, and a middle page at 320px, 375px, and desktop width. Inspect focus, overflow, text, contrast, background visibility, and 44px targets.
- [ ] Behavior-check first-run open, Skip, completion, menu reopen at page one, Back/Next/arrow/Escape navigation, Settings save/retry, and menu return paths.
- [ ] Prove NPC movement and game time continue under all four overlays. Confirm dialogue/loading/sleep/offline behavior is unchanged.
- [ ] Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`; run `pnpm check:pwa` if tutorial assets or service-worker precache behavior changed.
- [ ] Update maintained docs once with the durable menu, preference persistence, and tutorial behavior. Mark T38 complete only when every slice and required check passes.
- [ ] Stop and report Task 6. Do not start another project task.

## Unresolved Product Decisions

None. The approved design fixes menu actions, continuous-world behavior, five tutorial pages, device-local Sound, synchronized learning preferences, and first-run persistence.
