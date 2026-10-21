# Game Menu and Movement Tutorial Design

## Scope

Reorganize the in-game menu and replace the current single-message movement tutorial with a concise five-page illustrated tutorial. Preserve existing game progression, authentication, preference storage, dialogue settings access, and the local/offline practice distinction.

## Game menu

The game menu presents these actions as separate, balanced game-style buttons:

1. English Review (signed-in game only)
2. Movement Tutorial
3. Sign Out, or Leave Local Practice in practice mode
4. Return to Game
5. Settings

Settings are no longer expanded inside the game menu. Selecting Settings opens a separate overlay window containing the existing Sound, Coach, Voice Speed, and Voice Pitch controls. Closing Settings returns to the game menu. The existing compact dialogue settings control remains available during conversations.

Sound defaults to on and remains a device-local toggle. The browser cannot reliably read the device's physical/system volume, so the operating system controls the actual output level. Coach, Voice Speed, and Voice Pitch are account preferences synchronized through the server for signed-in players.

The menu and settings window reuse the warm cream, muted green, brown-gold border, rounded panel, and readable high-contrast style established by `apps/game/assets/ui` and the existing dialogue UI. Controls keep at least a 44px touch target and remain usable at 320px, 375px, and desktop widths.

## Movement tutorial

The tutorial is a five-page modal carousel:

1. **Move Around** — desktop keyboard controls (`WASD` and arrow keys) and the mobile touch control.
2. **Talk and Interact** — approach NPCs, counters, or entrances and use the interaction prompt.
3. **Follow Your Goals** — open Goals for the next step; `!` remains reserved for quests or important actions.
4. **Practice English** — speak or type replies, receive Coach corrections, and revisit useful material in English Review.
5. **Use the Game Menu** — find Settings and reopen the Movement Tutorial; finish with Start Exploring.

Each page contains one compact illustration, a short heading, no more than two short explanatory sentences, a `current / total` indicator, and navigation controls. Back is unavailable on the first page. Next advances pages, and the final page replaces Next with Start Exploring. Skip is available throughout. Left and right arrow keys navigate; Escape skips/closes the tutorial. Keyboard behavior must not trigger while focus is editing a form control.

Opening Movement Tutorial from the game menu always starts at page one. Closing a tutorial opened from the menu returns to the game menu. Completing or skipping the automatic first-run tutorial returns to the game.

## Continuous world behavior

The game menu, Settings, English Review, and Movement Tutorial are non-pausing overlays. While any of them is open:

- game time continues to advance;
- NPC schedules and movement continue;
- the active map remains mounted and visible behind the overlay;
- server-owned life simulation continues normally.

These overlays may capture keyboard and pointer input needed to operate their controls so the same input does not also move the player. Capturing player input is not a simulation pause: NPCs and time continue. Closing an overlay returns control to the same live world state.

This rule applies only to the menu and its utility windows. Existing dialogue, loading, sleep transition, offline, and server-state blocking behavior remains unchanged unless separately requested.

## First-run state

Keep the existing device-local `movementTutorialSeen` key. The tutorial opens automatically when that key is not `"1"`. Set it to `"1"` only when the player selects Skip or Start Exploring. Reopening the tutorial from the menu does not clear or otherwise change game progression.

If browser storage is unavailable, the game continues safely; the tutorial may appear again on a later reload, matching current behavior.

## Preference persistence and synchronization

Add a server-owned `player_preferences` record keyed by authenticated user ID. It stores only the synchronized learning preferences:

- `coach_enabled`, default `false`;
- `speech_rate`, default `1`, constrained to `0.75–1.5`;
- `speech_pitch`, default `1`, constrained to `0.75–1.25`;
- an `updated_at` timestamp.

Define the request and response schemas in `packages/shared`. NestJS exposes authenticated read and partial-update operations under the players domain. The client never accesses Supabase tables directly. The database migration adds the table, ownership constraint, bounds checks, and denies direct browser roles in line with existing data boundaries.

For a signed-in game, the client loads server preferences with player startup data or one authenticated preferences request. Server values become authoritative after loading. When no server record exists, the client submits its validated legacy local Coach, Voice Speed, and Voice Pitch values as a one-time initialization; the server creates the row atomically and returns the stored winner so concurrent devices cannot overwrite one another accidentally. Coach changes save immediately; slider changes update the preview immediately and are debounced before sending the latest value. While a save is pending, the Settings window communicates that state. On failure, it keeps the usable in-memory value, reports that synchronization failed, and offers Retry; it does not silently claim the setting was synchronized.

The latest synchronized learning preferences may be cached locally for fast startup and temporary offline use, but the server value wins after a successful fetch. This slice does not add a background offline mutation queue. Local practice and signed-out use remain device-local only and make no preferences API calls.

The existing `life-abroad.preferences` storage is migrated without losing user choices: Sound remains in device storage; existing Coach, Voice Speed, and Voice Pitch values act as the initial display/fallback and initialize an account that has no server preference record. After initialization, server values are authoritative.

## Visual assets

Use small purpose-built illustrations derived from existing runtime sprites and UI styling where practical. Do not add quest markers across the map. Do not overload `?` or `!` markers as a general help system in this slice.

## Component boundaries

- Keep game-menu action layout separate from preference controls.
- Give the Settings modal ownership of full preference controls.
- Keep device Sound state separate from synchronized account preference state.
- Put preference validation contracts in `packages/shared` and persistence in the NestJS players domain.
- Give the tutorial modal ownership of page state, keyboard navigation, and tutorial content.
- Keep `StationScreen` responsible only for deciding which overlay is open, where closing it returns, and whether player input is captured without stopping world simulation.
- Reuse the existing focus-trapped dialogue frame and preference hook rather than duplicating storage logic.

## Verification

- Unit/component checks cover page order, first/last navigation states, completion callbacks, and reopening at page one.
- Verify game menu to Settings and back, game menu to tutorial and back, first-run completion, Skip, arrow-key navigation, and Escape.
- Verify NPC movement and game time continue while the game menu, Settings, English Review, and Movement Tutorial are open.
- Verify authenticated preference loading, bounded updates, slider debouncing, failure/Retry feedback, cross-session reload, and no direct client database access.
- Verify Sound remains device-local and defaults on, while local practice makes no preference API calls.
- Render-check the menu, Settings modal, and representative tutorial pages at 320px, 375px, and a desktop viewport for overflow, focus visibility, readable text, and 44px touch targets.
- Run the focused game tests, game typecheck, and build appropriate to the touched files.

## Out of scope

- Server-synchronized tutorial completion.
- Server synchronization of the Sound toggle or device/system volume detection.
- Interactive movement-gated tutorial steps.
- A map-wide contextual help-marker system.
- Changes to quests, rewards, XP, coins, or persistent progression.
