# NPC Profiles, Moods, Relationships, Presence, and Natural Dialogue Implementation Plan

> **For agentic workers:** Use the host's available task-by-task implementation workflow. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build database-backed NPC profiles, time-zone-aware presence and moods, per-player relationships, natural deterministic small talk, and adaptive AI context without weakening server-owned quest or store behavior.

**Architecture:** Validated content JSON seeds versioned NPC profile JSONB, city time zones, and mood lookup rows. A focused `npcs` NestJS domain computes presence, base/effective mood, relationship stage, and bounded social reactions from server-owned game time; conversations consume that context while existing quest and seller services retain authority. The React/Phaser client receives an allowlist of currently present NPC IDs and only changes presentation, while the server guards new conversations.

**Tech Stack:** TypeScript 5.9, Zod, NestJS 11, PostgreSQL/Supabase migrations, React 19, Phaser 4, Node test runner, pnpm workspace.

## Global Constraints

- Supabase SDK remains client-auth-only; NestJS owns all remote game-data reads and writes.
- Quest, rewards, XP, coins, tickets, purchases, inventory, energy, mood, presence, and relationship state remain server-authoritative.
- Do not edit applied migrations; add forward migration `027_npc_profiles_moods_relationships.sql`.
- NPC statements about personal facts must come from validated `npcs.profile` JSONB. Missing facts produce a natural non-answer; scripts and AI must not invent them.
- Shared dialogue must resolve the selected city from database state and must not hard-code Maplewood.
- Default response level is A2; per-turn adaptation moves at most one CEFR band from the player's stored level.
- Street NPCs use broad small talk. Store workers remain professional and redirect to service; relationship state cannot change price, stock, hours, order validity, rewards, or quest progress.
- Base mood is schedule-driven. Age may shift energy/meal/sleep windows but never implies anger or friendliness; exceptional moods require authored temperament rules.
- Per-player conversation reactions expire; relationship scores persist and update idempotently in the saved-message transaction.
- NPC presence is based on game-local time in the selected city's IANA time zone. New conversations fail when the NPC is absent; already-open conversations may finish.
- No cron, client-authoritative filtering, unrestricted AI memory, relationship rewards, or new external libraries.
- Do not create commits unless the user gives separate explicit authorization; each commit command below is a prepared handoff, not an execution instruction.

---

### Task 1: Versioned profile, mood, city-time-zone, and relationship persistence

**Files:**
- Create: `content/seed/moods.json`
- Create: `apps/server/migrations/027_npc_profiles_moods_relationships.sql`
- Modify: `packages/shared/src/content.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `content/seed/town.json`
- Modify: `content/seed/npcs.json`
- Modify: `content/seed/street-npcs.json`
- Modify: `apps/server/src/infrastructure/content/seed-content.ts`
- Modify: `apps/server/src/infrastructure/content/seed.repository.ts`
- Modify: `apps/server/scripts/seed.mjs`
- Test: `packages/shared/tests/content-validation.test.mjs`
- Test: `apps/server/src/tests/seed-content.test.ts`
- Test: `apps/server/src/tests/database.integration.test.ts`

**Interfaces:**
- Consumes: existing `townSeedSchema`, `npcSchema`, `streetNpcContentSchema`, `loadSeedContent(root)`, and transactional `seedContent(client, content)`.
- Produces: `npcProfileSchema`, `moodTypeSchema`, `moodCatalogSchema`, `presenceScheduleSchema`, inferred `NpcProfile`/`MoodType` types, `town.timeZone`, `SeedContent.moods`, `cities.time_zone`, `npcs.profile`, `npcs.current_mood_id`, `npcs.mood_updated_at`, `mood_types`, and `npc_relationships`.

- [ ] **Step 1: Add focused failing schema and seed tests**

Add cases proving: profile version must equal `1`; age is an integer from 18 through 100; list values are trimmed, non-empty, and unique; temperament is one of `calm|cheerful|reserved|serious|sensitive`; daily routine and mood-rule times use `HH:mm`; presence days are unique valid weekday identifiers; slots reject empty days, equal start/end, unknown location IDs, and overlaps for the same location/day; town requires an IANA time-zone string; mood IDs are unique identifiers; unknown JSON keys fail strict parsing. Add seed tests asserting mood rows, city time zone, full profile JSON, and current mood are passed to SQL.

- [ ] **Step 2: Verify the relevant failure**

Run: `pnpm --filter @life-abroad/shared build && node --test packages/shared/tests/content-validation.test.mjs && pnpm --filter server build && node --test apps/server/dist/tests/seed-content.test.js`
Expected: tests fail because the new schemas, mood content, time zone, profiles, and seed writes do not exist.

- [ ] **Step 3: Implement schemas, authored content, migration, and seeding**

Define a strict profile object with `profileVersion: 1` and optional `age`, `hometown`, `hobbies`, `favoriteFood`, `family`, `likes`, `dislikes`, `conversationTopics`, `temperament`, `dailyRoutine`, `moodRules`, and `presenceSchedule`. Reuse the same schema for catalog and street NPCs. Author distinct facts and schedules for every street NPC; author smaller work-focused profiles and shifts for store NPCs. Add a strict mood catalog containing `neutral`, `happy`, `hungry`, `stressed`, `tired`, `relaxed`, `sleepy`, `sad`, `upset`, and `angry`, each with a label and concise dialogue guidance.

The forward migration must create `mood_types`, add `cities.time_zone` with an explicit value for the starter city before `NOT NULL`, add `npcs.profile jsonb NOT NULL DEFAULT '{"profileVersion":1}'`, add the mood FK/default/timestamp, and create `npc_relationships` with checks for familiarity `0..100`, affinity `-100..100`, nullable reaction mood/expiry, timestamps, a `(user_id,npc_id)` primary key, RLS enabled, and no client grants. Seed content must upsert mood types before NPCs, city time zone before locations, and complete profile JSON/current neutral mood without touching player rows.

- [ ] **Step 4: Verify the focused pass**

Run: `pnpm content:validate && pnpm --filter server build && node --test apps/server/dist/tests/seed-content.test.js`
Expected: content validation and seed unit tests pass, reporting the mood count in the seed summary.

- [ ] **Step 5: Run the affected integration check**

Run: `pnpm test:integration`
Expected: with local Supabase available, migration application and database tests prove the new constraints, defaults, FKs, RLS, and idempotent seed upserts. If Supabase is unavailable, report the check as not run rather than passed.

- [ ] **Step 6: Commit the passing deliverable**

```bash
git add packages/shared/src/content.ts packages/shared/src/index.ts packages/shared/tests/content-validation.test.mjs content/seed/town.json content/seed/npcs.json content/seed/street-npcs.json content/seed/moods.json apps/server/migrations/027_npc_profiles_moods_relationships.sql apps/server/src/infrastructure/content/seed-content.ts apps/server/src/infrastructure/content/seed.repository.ts apps/server/scripts/seed.mjs apps/server/src/tests/seed-content.test.ts apps/server/src/tests/database.integration.test.ts
git commit -m "feat(npcs): add validated profiles and mood persistence"
```

### Task 2: Server-owned time-zone-aware mood and presence domain

**Files:**
- Create: `packages/shared/src/npcs.ts`
- Create: `apps/server/src/modules/npcs/npcs.module.ts`
- Create: `apps/server/src/modules/npcs/npc-context.repository.ts`
- Create: `apps/server/src/modules/npcs/npc-mood.service.ts`
- Create: `apps/server/src/modules/npcs/npc-presence.service.ts`
- Create: `apps/server/src/modules/npcs/npcs.controller.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/server/src/app.module.ts`
- Modify: `apps/server/src/modules/conversations/conversations.module.ts`
- Modify: `apps/server/src/modules/conversations/conversations.service.ts`
- Test: `apps/server/src/tests/npc-mood.test.ts`
- Test: `apps/server/src/tests/npc-presence.test.ts`
- Test: `apps/server/src/tests/conversations.test.ts`

**Interfaces:**
- Consumes: `LifeRepository.state(client,userId)`, selected character map/place, location-to-city relation, `NpcProfile`, mood rows, and `ConversationRow` open/ended state.
- Produces: `NpcMoodService.resolve(client,userId,npcId): Promise<NpcMoodContext>`, `NpcPresenceService.forMap(client,userId,mapId): Promise<NpcPresenceResponse>`, `NpcPresenceService.assertCanStart(client,userId,npcId): Promise<void>`, shared `npcPresenceResponseSchema`, and authenticated `GET /npcs/presence?mapId=<location-id>`.

- [ ] **Step 1: Add focused failing mood and presence tests**

Use table-driven tests for exact schedule boundaries, weekday selection, multiple shifts, overnight slots, game-day rollover, and DST conversion through `Intl.DateTimeFormat` with the city's IANA zone. Assert start-inclusive/end-exclusive behavior. Prove store fallback uses venue hours only when no authored shift exists; missing street schedules are absent; unknown/malformed database profiles fail closed. Mood tests must cover neutral default, morning happy eligibility, 11:00–12:00 hunger, post-16:00 tiredness, post-19:00 relaxation, 21:00–22:00 sleepiness, explicit age/routine shifts, stable `npcId + gameDate + slot` exceptional selection, and no age/gender-based anger.

Add conversation tests asserting an absent NPC returns 409 on `POST /conversations`, while a conversation opened during a valid slot can continue after the shift ends.

- [ ] **Step 2: Verify the relevant failure**

Run: `pnpm --filter server build && node --test apps/server/dist/tests/npc-mood.test.js apps/server/dist/tests/npc-presence.test.js apps/server/dist/tests/conversations.test.js`
Expected: compilation/tests fail because the NPC domain, endpoint, contracts, and conversation guard do not exist.

- [ ] **Step 3: Implement the focused NPC domain**

Create a repository that locks/reads player life, character location, selected city/time zone, NPC profile, current mood, and relationship without exposing raw SQL outside the module. Convert the absolute game instant to city-local weekday/minutes with built-in `Intl`; do not use the host time zone. Resolve deterministic mood from authored rules and lazily update `npcs.current_mood_id,mood_updated_at` only when the base mood changes.

Return a response containing `mapId`, `gameTime`, `timeZone`, `presentNpcIds`, and `nextChangeAt`. Derive `nextChangeAt` by examining upcoming authored boundaries, including overnight windows. Add the presence guard before conversation creation but not before sending to an already-open conversation. Return the standard 409 API error with `NPC is not here right now` when absent.

- [ ] **Step 4: Verify the focused pass**

Run: `pnpm --filter @life-abroad/shared build && pnpm --filter server build && node --test apps/server/dist/tests/npc-mood.test.js apps/server/dist/tests/npc-presence.test.js apps/server/dist/tests/conversations.test.js`
Expected: mood, presence, and conversation guard tests pass without changing quest or seller assertions.

- [ ] **Step 5: Run the affected integration check**

Run: `pnpm --filter server test`
Expected: all non-integration server tests pass; no existing conversation, quest, seller, life, or AI test regresses.

- [ ] **Step 6: Commit the passing deliverable**

```bash
git add packages/shared/src/npcs.ts packages/shared/src/index.ts apps/server/src/modules/npcs apps/server/src/app.module.ts apps/server/src/modules/conversations/conversations.module.ts apps/server/src/modules/conversations/conversations.service.ts apps/server/src/tests/npc-mood.test.ts apps/server/src/tests/npc-presence.test.ts apps/server/src/tests/conversations.test.ts
git commit -m "feat(npcs): resolve mood and scheduled presence"
```

### Task 3: Client rendering and interaction for scheduled NPC presence

**Files:**
- Create: `apps/game/src/features/npcs/npc-presence-api.ts`
- Create: `apps/game/src/features/npcs/useNpcPresence.ts`
- Modify: `apps/game/src/api/client.ts`
- Modify: `apps/game/src/gameplay/StationScreen.tsx`
- Modify: `apps/game/src/gameplay/GameCanvas.tsx`
- Modify: `apps/game/src/gameplay/create-station-game.ts`
- Modify: `apps/game/src/features/npcs/npc-actors.ts`
- Test: `apps/game/tests/npc-presence.test.mjs`
- Test: `apps/game/tests/station-screen.test.mjs`

**Interfaces:**
- Consumes: authenticated `GET /npcs/presence`, `npcPresenceResponseSchema`, current map ID callbacks, and the existing actor list loaded from the map pack.
- Produces: `useNpcPresence(run,mapId,gameTime)` with `{presentNpcIds,error,refresh}`, plus a Phaser visibility/interactivity allowlist that never authorizes server actions.

- [ ] **Step 1: Add focused failing client tests**

Assert that an actor not in `presentNpcIds` is invisible, omitted from minimap/nearest-NPC selection, and cannot open a dialogue; a present actor behaves unchanged. Assert refresh on map ID change, `nextChangeAt`, and reconnect; an already-open conversation remains rendered after its actor becomes absent; API failure leaves street NPCs unavailable and shows a retryable status instead of assuming everyone is present.

- [ ] **Step 2: Verify the relevant failure**

Run: `node --import tsx --test apps/game/tests/npc-presence.test.mjs apps/game/tests/station-screen.test.mjs`
Expected: tests fail because presence loading and actor filtering are missing.

- [ ] **Step 3: Implement client presence projection**

Parse the server response in the API layer. Keep all pack actors loaded, but mark availability in the Phaser scene so actor sprites, labels, shadows, collision/nearest selection, and minimap entries follow the allowlist. Schedule a refresh at `nextChangeAt` using the server response, and refresh on map entry/reconnect. Do not close an open conversation solely because the shift ended; prevent only new selection. Preserve practice mode by using its existing local/static NPC behavior.

- [ ] **Step 4: Verify the focused pass**

Run: `node --import tsx --test apps/game/tests/npc-presence.test.mjs apps/game/tests/station-screen.test.mjs`
Expected: presence and StationScreen tests pass with absent actors non-interactive and open conversations preserved.

- [ ] **Step 5: Run the affected integration check**

Run: `pnpm --filter game typecheck && pnpm --filter game build`
Expected: strict typecheck and production build pass. Manually verify 320px, 375px, and wide layouts for the retry status; record real-device checks as not run unless performed.

- [ ] **Step 6: Commit the passing deliverable**

```bash
git add apps/game/src/features/npcs/npc-presence-api.ts apps/game/src/features/npcs/useNpcPresence.ts apps/game/tests/npc-presence.test.mjs apps/game/src/api/client.ts apps/game/src/gameplay/StationScreen.tsx apps/game/src/gameplay/GameCanvas.tsx apps/game/src/gameplay/create-station-game.ts apps/game/src/features/npcs/npc-actors.ts apps/game/tests/station-screen.test.mjs
git commit -m "feat(game): show NPCs by server schedule"
```

### Task 4: Database-backed natural dialogue and profile facts

**Files:**
- Create: `content/dialogue/common/profile.json`
- Modify: `content/dialogue/common/conversation.json`
- Modify: `content/dialogue/common/greetings.json`
- Modify: `content/dialogue/common/role_townsperson.json`
- Modify: `content/dialogue/common/role_shop_companion.json`
- Modify: `content/dialogue/common/role_seller_cafe.json`
- Modify: `content/dialogue/npc_receptionist.json`
- Modify: `content/dialogue/npc_cafe_waiter.json`
- Modify: `content/dialogue/npc_cafe_customer.json`
- Modify: `content/dialogue/npc_clothes_assistant.json`
- Modify: `content/dialogue/npc_clothes_customer.json`
- Modify: `content/dialogue/npc_clothes_seller.json`
- Modify: `apps/server/src/modules/dialogue/dialogue.service.ts`
- Modify: `apps/server/src/modules/conversations/conversations.repository.ts`
- Modify: `apps/server/src/modules/conversations/seller.service.ts`
- Test: `apps/server/src/tests/dialogue.test.ts`
- Test: `apps/server/src/tests/seller.integration.test.ts`

**Interfaces:**
- Consumes: database-backed NPC/city/profile/effective-mood context and existing NPC → role → global authored-node precedence.
- Produces: expanded `DialogueContext` with allowlisted render values and deterministic intents for identity, work, routines, preferences, local place, thanks, apology, compliment, and missing facts.

- [ ] **Step 1: Add exhaustive table-driven failing dialogue tests**

Cover correct and learner forms for name, age, hometown, family, job, workplace, feelings about work, hobbies, favorite food, likes/dislikes, books, music, art, pets, travel, school, city, local places, routine, current activity, plans, wellbeing, weather, thanks, apology, compliment, and farewell. Include `How old you?`, `Where you from?`, and `What food you like?`; negative/boundary cases must not match substrings or turn refusals into positive requests. Assert every rendered fact equals fixture database context, missing facts use a natural non-answer, and city text uses `{cityName}`.

For store roles, assert small talk answers in one short sentence then redirects to service. Re-run all order/menu/price/payment/cancel/closed-store tests and assert their intent IDs, totals, inventory effects, and quest metadata are unchanged.

- [ ] **Step 2: Verify the relevant failure**

Run: `pnpm content:validate && pnpm --filter server build && node --test apps/server/dist/tests/dialogue.test.js`
Expected: new coverage fails because profile intents, render context, and natural authored nodes are absent.

- [ ] **Step 3: Implement allowlisted factual rendering and rewrite scripts**

Load `name`, role/job, profile, selected city/place, mood, and relationship stage into `DialogueContext`. Replace the unrestricted single-name substitution with an explicit renderer that supports only documented scalar/list tokens and never evaluates input. Add deterministic profile intents and common learner keywords. For missing values, route to a dedicated authored response instead of leaving a token or invoking AI.

Rewrite stiff small-talk lines into direct, natural one- or two-sentence replies with at most one follow-up. Keep quest completion markers, seller intent IDs, transaction branches, prices, quantities, and rewards untouched. Store-role variants must end with a relevant service question.

- [ ] **Step 4: Verify the focused pass**

Run: `pnpm content:validate && pnpm --filter server build && node --test apps/server/dist/tests/dialogue.test.js`
Expected: all dialogue cases pass, including missing-fact and dynamic-city assertions.

- [ ] **Step 5: Run the affected integration check**

Run: `pnpm --filter server test`
Expected: complete non-integration server suite passes, including seller, quest, AI, speech, and dialogue regressions.

- [ ] **Step 6: Commit the passing deliverable**

```bash
git add content/dialogue apps/server/src/modules/dialogue/dialogue.service.ts apps/server/src/modules/conversations/conversations.repository.ts apps/server/src/modules/conversations/seller.service.ts apps/server/src/tests/dialogue.test.ts apps/server/src/tests/seller.integration.test.ts
git commit -m "feat(dialogue): answer natural profile questions"
```

### Task 5: Per-player relationship state and conversation reactions

**Files:**
- Create: `apps/server/src/modules/npcs/npc-relationship.service.ts`
- Create: `apps/server/src/modules/npcs/social-signal.ts`
- Modify: `apps/server/src/modules/npcs/npcs.module.ts`
- Modify: `apps/server/src/modules/conversations/conversations.service.ts`
- Modify: `packages/shared/src/conversations.ts`
- Test: `apps/server/src/tests/npc-relationship.test.ts`
- Test: `apps/server/src/tests/conversations.test.ts`

**Interfaces:**
- Consumes: normalized player message, scripted intent, current relationship row, NPC temperament, conversation/message idempotency, and the current transaction.
- Produces: `classifySocialSignal(text,intent): SocialSignal | null`, `NpcRelationshipService.context(client,userId,npcId)`, and `NpcRelationshipService.apply(client,userId,npcId,signal,now)` returning bounded familiarity, affinity, relationship stage, reaction mood, and expiry.

- [ ] **Step 1: Add focused failing relationship tests**

Assert greeting, thanks, polite request, apology, clear insult, and repeated harassment changes. Assert ambiguous text, grammar mistakes, repeated ordinary questions, and unknown text change nothing. Verify familiarity `0..100`, affinity `-100..100`, per-turn/per-game-day caps, stage thresholds, reaction expiry, apology softening without instant reset, and no one-turn jump to friend. Verify retrying the same `clientMessageId` returns the saved response without a second relationship update.

Add store assertions proving low affinity only selects a shorter professional wording and cannot alter catalog, price, hours, payment, inventory, or successful order behavior.

- [ ] **Step 2: Verify the relevant failure**

Run: `pnpm --filter server build && node --test apps/server/dist/tests/npc-relationship.test.js apps/server/dist/tests/conversations.test.js`
Expected: tests fail because social classification and transactional relationship updates are missing.

- [ ] **Step 3: Implement bounded server-owned social state**

Use explicit normalized phrase rules and existing deterministic intent metadata; do not ask the AI provider to score players. Lock/upsert `(user_id,npc_id)` inside the conversation transaction. Apply small configured deltas, cap daily positive gains, set temporary `upset`/`angry` reactions only for explicit negative signals, and expire reactions by game time. Run replay detection before classification/update. Attach read-only mood/relationship metadata to the turn only if it is needed by the UI; never accept it from requests.

- [ ] **Step 4: Verify the focused pass**

Run: `pnpm --filter @life-abroad/shared build && pnpm --filter server build && node --test apps/server/dist/tests/npc-relationship.test.js apps/server/dist/tests/conversations.test.js`
Expected: bounded relationship, expiry, store professionalism, and idempotency tests pass.

- [ ] **Step 5: Run the affected integration check**

Run: `pnpm test:integration`
Expected: with local Supabase available, concurrent/replayed messages produce one relationship update in the same committed transaction; failed messages commit neither message nor relationship changes.

- [ ] **Step 6: Commit the passing deliverable**

```bash
git add apps/server/src/modules/npcs/npc-relationship.service.ts apps/server/src/modules/npcs/social-signal.ts apps/server/src/modules/npcs/npcs.module.ts apps/server/src/modules/conversations/conversations.service.ts packages/shared/src/conversations.ts apps/server/src/tests/npc-relationship.test.ts apps/server/src/tests/conversations.test.ts
git commit -m "feat(npcs): track bounded player relationships"
```

### Task 6: Adaptive language, mood-aware speech/AI, documentation, and final verification

**Files:**
- Create: `apps/server/src/modules/dialogue/response-level.ts`
- Modify: `apps/server/src/modules/ai/npc-prompt.service.ts`
- Modify: `apps/server/src/modules/ai/prompts.ts`
- Modify: `apps/server/src/modules/speech/speech-profile.service.ts`
- Modify: `apps/server/src/modules/conversations/conversations.service.ts`
- Modify: `docs/GAME.md`
- Modify: `docs/TECH.md`
- Test: `apps/server/src/tests/response-level.test.ts`
- Test: `apps/server/src/tests/npc-prompt.test.ts`
- Test: `apps/server/src/tests/voice-selection.test.ts`

**Interfaces:**
- Consumes: stored player CEFR level, current normalized message, effective NPC mood, relationship stage, validated NPC profile, current city/place, and existing AI/speech provider interfaces.
- Produces: `resolveResponseLevel(playerLevel,text): CefrLevel`, a factual allowlisted AI persona, and mood-to-supported-Azure-style selection with safe fallback.

- [ ] **Step 1: Add focused failing adaptation and prompt tests**

Assert default A2 when data is unavailable; simple/short input can move one band down; clearly complex input can move one band up; no input moves more than one band from stored level; invalid/ambiguous input stays at the stored level. Prompt tests must include validated facts, city/place, effective level, mood, relationship stage, professional store instruction, and direct-answer instruction while excluding private display name, character name, email, UUIDs, raw JSON fields not on the allowlist, and any missing-fact assertion. Speech tests must map happy/sad to supported Azure styles and fall back to default for unsupported hungry/tired/angry styles.

- [ ] **Step 2: Verify the relevant failure**

Run: `pnpm --filter server build && node --test apps/server/dist/tests/response-level.test.js apps/server/dist/tests/npc-prompt.test.js apps/server/dist/tests/voice-selection.test.js`
Expected: tests fail because response-level resolution and enriched safe context do not exist.

- [ ] **Step 3: Implement adaptation and update maintained documentation**

Implement a deterministic complexity heuristic using message length, sentence count, conjunctions, and existing grammar/question helpers; keep it small and return an existing CEFR enum. Extend the AI allowlist with only validated profile facts and resolved context. Use effective mood for speech style only when the selected voice supports it. Update `docs/GAME.md` with observable profile, mood, presence, relationship, city-time-zone, store professionalism, and adaptive-language rules. Update `docs/TECH.md` with migration `027`, JSONB/schema ownership, NPC module interfaces, endpoint contract, transaction/idempotency behavior, and client refresh flow.

- [ ] **Step 4: Verify the focused pass**

Run: `pnpm --filter server build && node --test apps/server/dist/tests/response-level.test.js apps/server/dist/tests/npc-prompt.test.js apps/server/dist/tests/voice-selection.test.js`
Expected: adaptation, privacy, prompt, and speech-style tests pass.

- [ ] **Step 5: Run final repository gates**

Run: `pnpm content:validate && pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: every command exits successfully. Then run `pnpm test:integration`; report pass only when local Supabase is available and all integration tests complete. Inspect `git diff --check` and confirm no unrelated files changed.

- [ ] **Step 6: Commit the passing deliverable**

```bash
git add apps/server/src/modules/dialogue/response-level.ts apps/server/src/modules/ai/npc-prompt.service.ts apps/server/src/modules/ai/prompts.ts apps/server/src/modules/speech/speech-profile.service.ts apps/server/src/modules/conversations/conversations.service.ts apps/server/src/tests/response-level.test.ts apps/server/src/tests/npc-prompt.test.ts apps/server/src/tests/voice-selection.test.ts docs/GAME.md docs/TECH.md
git commit -m "feat(npcs): adapt dialogue to mood and learner level"
```

## Unresolved Product Decision

- The current fictional starter city needs an explicit IANA time zone. Recommendation: author `Europe/Stockholm` for the existing Maplewood seed because it matches the project's current product context and exercises daylight-saving behavior; changing the value later is content-only.
