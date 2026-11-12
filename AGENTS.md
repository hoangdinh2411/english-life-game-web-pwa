# Life Abroad — Antigravity Agent Instructions

Web-first English-learning RPG (D16). Keep slices small, code simple, responses concise.
Client: Vite + React + TS + Phaser 4 + PWA (no Expo/React Native/WebView). Main thread only.

## Non-negotiable Boundaries
- **Auth & Data**: Supabase SDK authenticates client; NestJS verifies tokens and owns all remote game data. No direct client PostgREST/DB access.
- **Progression**: Server alone mutates quests, rewards, XP, and coins (transactional & idempotent). Station `/practice` is offline/local without persistent grants.
- **Content**: Author dialogue in validated `content/` JSON, seeded to PostgreSQL.
- **Structure**: Client code is feature-first (`src/features/<feature>`); server is domain modules (`src/modules/<domain>`). Shared contracts live in `packages/shared`.
- **Palette**: Use shared semantic tokens (`var(--color-...)`, `src/styles/colors.ts`); no hex color literals in React markup.
- **Hygiene**: No secrets or private tokens in Git/logs/bundles. Forward-only DB migrations.

## Project Map (Top-Level & Second-Level Directories)
### Client (`apps/game/src/`)
- `api/` — API client and HTTP services for server communication
- `app/` — Application root, providers, routing, and shell lifecycle
  - `app/new-game/` — Character bootstrap and new game initialization screens
- `components/` — Shared reusable React UI presentation components
- `features/` — Domain feature slices containing UI and local state
  - `features/appearance/` — Character visual customizer and avatar UI
  - `features/assets/` — Map and sprite asset loaders and cache management
  - `features/dialogue/` — Interactive dialogue overlay and branch choice UI
  - `features/game-menu/` — In-game pause, settings, and navigation modal
  - `features/hud/` — Heads-up display, status meters, and stats indicators
  - `features/id-card/` — Player identity card inspection modal
  - `features/learning/` — English language practice drills and quiz interface
  - `features/life/` — Life simulation meters (energy, mood, hunger UI)
  - `features/location/` — Area transition states and location banner UI
  - `features/minimap/` — Minimap radar and spatial tracking display
  - `features/npcs/` — NPC visual representations and interaction triggers
  - `features/shops/` — Shop inventory and purchase/sale interface
  - `features/station/` — Offline practice station and drill interface
  - `features/tax-office/` — Town hall and tax office interaction screens
  - `features/tutorial/` — Onboarding and tutorial walkthrough overlays
  - `features/world-clock/` — In-game clock display and time sync
- `gameplay/` — Phaser 4 game engine scenes, physics, and world render loop
- `hooks/` — Custom React lifecycle, state, and audio hooks
- `navigation/` — Client-side route declarations and route guards
- `onboarding/` — First-time user setup and questionnaire sequence
- `pwa/` — Progressive Web App service worker and offline caching
- `session/` — User authentication state and session persistence
- `shared/` — Client-specific utilities, formatters, and helpers
- `speech/` — Speech synthesis, voice recognition, and audio playback
- `styles/` — Shared CSS tokens, themes, and semantic color definitions
- `types/` — Client TypeScript type definitions
  - `types/gameplay/` — Phaser scene, physics, and world state types
  - `types/speech/` — Speech recognition and TTS audio interfaces
  - `types/ui/` — UI component props and layout contracts

### Backend Server (`apps/server/src/`)
- `common/` — Cross-cutting NestJS infrastructure utilities
  - `common/filters/` — Global exception filters and HTTP error mapping
  - `common/guards/` — Auth token verification and route access guards
  - `common/pipes/` — Request payload validation and transformation pipes
- `database/` — PostgreSQL connection pool, migration scripts, and seeds
- `health/` — Server health check endpoints and readiness probes
- `infrastructure/` — External service integrations and persistence adapters
  - `infrastructure/auth/` — Supabase authentication token verification adapter
  - `infrastructure/content/` — Dialogue content loader and JSON validator
  - `infrastructure/database/` — Database repository clients and connection pools
- `modules/` — Domain-driven NestJS modules implementing business logic
  - `modules/ai/` — LLM evaluation and AI feedback services
  - `modules/auth/` — Player authentication and session verification
  - `modules/content/` — Story content delivery and scenario endpoints
  - `modules/conversations/` — Conversation logging and dialogue session state
  - `modules/dialogue/` — Dialogue tree evaluation and state transitions
  - `modules/economy/` — Currency transactions and coin balance logic
  - `modules/id-card/` — Player ID card issuance and persistence
  - `modules/learning/` — Learning metrics, lesson evaluations, and skill mastery
  - `modules/life/` — Life simulation mechanics (energy, mood, hunger calculations)
  - `modules/npcs/` — NPC profiles, spawn rules, and relationship states
  - `modules/onboarding/` — Onboarding questionnaire and starter data bootstrap
  - `modules/players/` — Player profile management and persistent stats
  - `modules/quests/` — Quest state machine, objectives, and progression
  - `modules/shops/` — Shop catalog, item purchases, and inventory
  - `modules/speech/` — Speech processing, audio streaming, and voice TTS
  - `modules/world-clock/` — Game world clock and scheduled events
- `scripts/` — Server maintenance, migration, and CLI utility scripts
- `tests/` — Integration and end-to-end test suites
  - `tests/support/` — Test fixtures, factories, and harness utilities

### Shared Package (`packages/shared/src/`)
- `dialogue/` — Shared dialogue schema definitions and contracts
  - `dialogue/content/` — Dialogue content models and schema validators

## Git Guardian Rule
Before starting any task, check `git branch --show-current`. If currently on `main`, `master` or `dev`, automatically create and switch to a new branch `feat/<feature-name>` (from `dev`) before making any changes. Never work directly on `main`, `master`, or `dev`.
Never create commits, tags, PRs, merges or pushes; the user owns them. Suggest a commit message instead.

## 3-Stage Sequential Pipeline
Order is always `planner` → `coder` → `reviewer`. **Stage 3 (`reviewer`) is mandatory in every mode** and runs automatically right after `coder`, with no user prompt needed. Two modes decide only how Stage 1 ends:
- **Interactive mode (default)**: Stage 1 stops and waits for the user's explicit "OK" or "Approve" before Stage 2.
- **Task-driven mode** (the prompt references `docs/MASTER_PROMPT.md` and/or a task ID such as `T40.a`): the user's prompt counts as approval. State a brief plan in chat (no stop), then run `coder` → `reviewer` to completion. Stop early only for a critical ambiguity, a blocker, or an unapproved player flow (see `docs/MASTER_PROMPT.md` §3).
1. **Stage 1 (`planner`)**: Analyze request, identify edge cases, produce standardized plan (stop for approval only in Interactive mode).
2. **Stage 2 (`coder`)**: Implement minimal coherent changes strictly following the approved plan (`a, b, c...` sequence). Hand off to `reviewer` automatically.
3. **Stage 3 (`reviewer`)**: Inspect `git diff`, run `pnpm typecheck` (plus lint/tests/acceptance checks when the task requires them). Do not edit code itself.

## Coder ↔ Reviewer Exchange
If `reviewer` finds any problem, `reviewer` and `coder` must talk it through **visibly to the user**:
1. `Reviewer → Coder`: list each issue (file, line, error/rule violated, suggested fix).
2. `Coder → Reviewer`: say what was fixed (or why it disagrees); only `coder` edits code.
3. `Reviewer` re-runs checks. Repeat up to 3 rounds until 0 errors.
Show each message in the reply as a short log (`Round N`). If errors remain after round 3, stop and report the blocking issues to the user; never claim a check passed unless it ran and passed.

## Work Loop & Reply Guidelines
1. **Branch**: Enforce the Git Guardian Rule.
2. **Execute**: Follow the 3-Stage Sequential Pipeline (`planner` -> `coder` -> `reviewer`).
3. **Verify**: Run `pnpm typecheck` and `git diff` via reviewer. Never claim unrun tests passed.
4. **Reply**: Use the `docs/MASTER_PROMPT.md` §8 format (Task / Implemented / Files / Verification / User testing checklist / Status / Notes), plus the Coder ↔ Reviewer log if any issue was found. Never claim unrun checks passed. The checklist is split into Client and Backend/API (Precondition, Input/Action, Expected output).

## Root Commands
`pnpm dev` · `pnpm dev:game` · `pnpm dev:server` · `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm content:validate` · `pnpm build` · `pnpm check:pwa` · `pnpm test:integration`
