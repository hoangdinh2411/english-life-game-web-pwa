# Server — NestJS / PostgreSQL / Supabase

Follow `../../AGENTS.md`. Read `../../docs/TECH.md` only as needed.

- **NestJS domain modules** live in `src/modules/<domain>/`: existing
  `auth`, `onboarding`, `players`; add `dialogue`, `conversations`, `quests`,
  `economy`, `learning` or `ai` **only when their task arrives**. One module
  owns one capability and its data; avoid one giant `GameService` or generic
  `utils`/`common` buckets for domain rules.
- Within a module, use thin controllers (HTTP), focused services (domain
  decisions) and repositories (SQL) as complexity warrants; request schemas
  and unit tests can live beside the feature. Do not create every possible
  layer/file for a simple provider. Export explicit services/contracts to
  other modules, not repositories or raw database internals.
- Keep infrastructure (`database`, content loading/cache, external adapters)
  in `src/infrastructure/`; `src/common/` is for genuinely global Nest pipes,
  filters and guards. Put cross-client API schemas in `packages/shared`.
- Coordinate **conversations → dialogue → quests → economy** through public
  service methods without circular NestJS imports. `conversations` records
  messages and coordinates intent; `quests` owns ordered progress/ticket
  entitlement; `economy` owns XP/coin grants. When a quest completion also
  grants rewards, use a **single database transaction** with a unique claim
  guard/ledger so retries and concurrent requests cannot double-pay. Don't
  scaffold an inventory service for the arrival bus ticket.
- Supabase owns credentials. Protected endpoints use `AuthGuard` and
  `CurrentUser`; no duplicate `/auth/*` endpoints or controller-level token parsing.
- Validate inputs using existing shared Zod schemas and
  `SchemaValidationPipe`; use the global API error format
  `{ "error": { "code": "...", "message": "..." } }`.
- All quest state, XP, coins, rewards and future energy remain server-authoritative.
  Reward writes must be idempotent and transactional. Append-only conversations;
  don't log private text or secrets.
- Dialogue is authored in `content/dialogue`, validated/seeded to
  `dialogue_nodes` and read through a cache. Match NPC → role → global; never
  query the database for each line. Station-only practice stays client-local.
- Use forward-only migrations; inspect the existing schema and never reset a
  user's database or alter applied migrations without explicit authorization.
- AI and rate limiting are future scoped tasks. Keep provider keys server-side,
  use interfaces/mocks in tests and don't invent unapproved caps or policies.
- Tests normally live in `src/tests`. Verify changed server logic with focused
  tests; run real local integration checks when persistence/auth behavior changes
  and infrastructure is available. A skipped integration check is **not** proof.
