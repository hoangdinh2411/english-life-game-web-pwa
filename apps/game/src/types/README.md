# Client types

Keep client-only contracts here, grouped by the feature that owns them.
Use explicit `import type` paths; avoid a single barrel that joins unrelated
domains. Shared API schemas/contracts remain in `packages/shared` and are
imported directly rather than copied here.

| Group | Responsibility |
| --- | --- |
| `gameplay/world.ts` | Coordinates, movement, Phaser boundary and canvas contracts |
| `gameplay/dialogue.ts` | Local conversation messages and fallback metadata |
| `gameplay/goals.ts` | Local preview goals and HUD state |
| `speech/recognition.ts` | Optional browser recognition adapter contracts |
| `speech/narration.ts` | Recorded audio and browser synthesis contracts |
| `ui/` | React component props, grouped by onboarding/gameplay |
| `session.ts` | Credential storage, refresh manager and context contract |
| `onboarding.ts` | Client draft of the shared character request |
| `navigation.ts` | Browser route policy and redirects |
| `pwa.ts` | Install/update/network context |
| `env.d.ts` | Vite/PWA ambient declarations and public environment names |

Implementation lives in the corresponding feature folders as `.ts` or `.tsx`.
Do not recreate `.mjs`/`.d.mts` pairs for client code: TypeScript checks the
implementation and its imports together. `.d.ts` remains appropriate for
ambient declarations such as `import.meta.env`.
