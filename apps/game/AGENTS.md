# Game app — Vite / React / Phaser / PWA

Follow `../../AGENTS.md`. Read `../../docs/TECH.md` only as needed.

- One responsive browser/PWA app. Vite + React DOM (routes, forms, HUD and
  accessible dialogue); Phaser 4 (world and movement); strict TypeScript. Do not
  add Expo, React Native, native WebViews or a second frontend.
- Style React UI with Tailwind utilities. Keep `src/styles.css` limited to
  Tailwind imports/theme tokens, shared element defaults and animation
  keyframes; see `docs/TECH.md` for conventions. Preserve existing
  responsive/focus behavior.
- Reuse semantic color tokens instead of hard-coding colors in components.
  Prefer named utilities such as `text-ink`, `bg-paper`, and `border-border`,
  or `var(--color-...)` for arbitrary values. Never add literals such as
  `text-[#52644f]`, `bg-[#...]`, or `border-[#...]` to React markup. For
  Phaser/canvas/PWA configuration, import `UI_COLORS` from
  `src/styles/colors.ts`; keep literal values only in the shared token
  definitions.
- **Feature-first for new work:** put each cohesive user-facing capability under
  `src/features/<feature>/` (e.g. `station`, `dialogue`, `quests`,
  `onboarding`). Add `components/`, `hooks/`, `api/`, `game/`, or `model/`
  **only when needed**; keep a small feature flat. Components render UI, hooks
  manage UI state/effects, API functions call NestJS, and Phaser scenes handle
  rendering/input rather than quest or reward business rules.
- Keep app composition/routing in `src/App.tsx`, `src/app` and `src/navigation`;
  put genuinely cross-feature UI/hooks/helpers in `src/shared/` only after
  reuse. Shared server-client schemas/rules belong in `packages/shared`; do not
  place feature-specific code in global `components/`, `types/`, `hooks/` or
  `gameplay/` as those folders become grab bags.
- Existing technical folders (`src/gameplay`, `src/onboarding`, `src/speech`,
  etc.) still work: do **not** bulk-move files for style alone. On the next
  substantive change, move the relevant cohesive slice to its feature and fix
  imports/tests within that task. Avoid circular feature imports and giant
  index/barrel files. Preserve station NPC IDs, interactions and voices.
- `src/api/supabase-auth.ts` authenticates via Supabase SDK; `src/api/client.ts`
  accesses **NestJS only** for remote game data. Never award server-owned
  XP/coins/quest progress in client code.
- `/practice` is unauthenticated, local and deterministic. It works offline
  after public assets are cached and grants **no** saved progress or rewards.
- Client credentials/expiry use browser `localStorage` and legacy migration from
  `sessionStorage`; clear both on logout. Cache only public PWA shell/assets,
  not API/Auth responses, tokens or private state. No offline reward queue.
- Keep browser speech optional; typing always works. PWA updates activate only
  after user confirmation, at onboarding or the paused game menu.
- For changed UI, give the user a focused browser checklist covering 320px and
  375px plus a wider viewport: overflow, keyboard focus, errors, readable layout
  and 44px touch targets. For Phaser changes, include resize, teardown/remount
  and background pause. The user performs browser and device verification; state
  those checks as **not run** unless the user reports results.
- Prefer targeted UI/tests; use a production build and `pnpm check:pwa` for
  changes involving service workers, assets, manifest or offline behavior.
