# Life Abroad

A web-first English-learning RPG: Vite + React + TypeScript + Phaser 4 + PWA,
NestJS and Supabase. Play the local, reward-free train-station practice at
`/practice`. The next milestone is a **server-backed train-station arrival
quest**: talk to the receptionist, earn a bus ticket, and travel to Town Street.
Café quests come after that. The ticket quest is not implemented yet.

## Quick start

```sh
pnpm install
pnpm dev
```

Open http://localhost:8082. Auth and character creation need local Supabase
and public `VITE_*` settings; see [setup and API](docs/TECH.md). Practice works
without an account. Production PWA/offline features require a built preview.

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm content:validate
pnpm build
pnpm check:pwa
```

**Start here:** [tasks](docs/TASKS.md) · [game behavior](docs/GAME.md) ·
[architecture, code structure and setup](docs/TECH.md) · [coding rules](AGENTS.md).

New client features use a **feature-first** structure; backend capabilities
use focused **NestJS domain modules**. Existing source folders are migrated
incrementally rather than reorganized in one risky pass.

Project code, migrations, tests and assets are preserved. Historical plans and
verification reports are not active instructions; keep project history in Git
or the original archive, not in generated workflow files.

No native Expo build is planned (D16). Physical-device PWA installation and
airplane-mode behavior are not yet verified.
