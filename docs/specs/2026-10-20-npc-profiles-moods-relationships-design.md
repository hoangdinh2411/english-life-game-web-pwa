# NPC Profiles, Moods, Relationships, and Natural Dialogue

## Goal

Make ordinary NPC conversations feel grounded and varied without inventing facts. Street NPCs answer broad everyday questions from validated database data. Store workers remain focused on service and customer satisfaction. Quest, purchase, reward, and progression behavior remains server-authoritative and unchanged.

## Scope

- Add structured, extensible NPC personal profiles stored as validated JSONB.
- Add data-driven mood types and time-based base moods.
- Add per-player NPC relationships and short-lived conversation reactions.
- Add server-authoritative NPC presence schedules based on game-local time.
- Expand deterministic everyday-question coverage, including common learner grammar mistakes.
- Rewrite affected authored dialogue to sound more natural while preserving transactional and quest semantics.
- Adapt response complexity per turn, defaulting to CEFR A2.

This slice does not add relationship rewards, relationship-gated quests, autonomous background simulation, unrestricted AI memory, or client-authoritative state.

## Data Model

### NPC profile

Add `profile jsonb` to `public.npcs` using a forward migration. The authored content remains the seed source, and the server reads the seeded database value at runtime.

The JSON object has a required `profileVersion` and optional validated fields:

- `age`: positive integer in a realistic human range.
- `hometown`: authored place name.
- `hobbies`: unique non-empty strings.
- `favoriteFood`: non-empty string.
- `family`: short authored summary.
- `likes`: unique non-empty strings.
- `dislikes`: unique non-empty strings.
- `conversationTopics`: unique topic identifiers.
- `temperament`: authored identifiers used by mood rules, not inferred from age or gender.
- `dailyRoutine`: structured time windows relevant to energy, meals, work, and rest.
- `moodRules`: bounded NPC-specific adjustments to the default mood schedule.
- `presenceSchedule`: validated weekly appearance windows and location IDs.

Missing data is meaningful. NPCs must not guess a missing fact. Street NPC profiles should contain enough authored detail to produce distinct answers. Store-worker profiles may be intentionally smaller because their dialogue returns to customer service.

The shared Zod schema is strict and versioned. Invalid or unknown profile fields fail content validation and seeding.

### City time zone

Add a validated IANA time-zone identifier to authored city content and `public.cities`. The player's selected city determines the game-local time used by mood and presence rules. The starter city must receive an explicit value during the forward migration and seed; the server must not fall back to the host machine's time zone.

### Mood types

Create `public.mood_types` as a data-driven lookup table. Initial IDs are:

- `neutral`
- `happy`
- `hungry`
- `stressed`
- `tired`
- `relaxed`
- `sleepy`
- `sad`
- `upset`
- `angry`

Each row contains a display label and validated dialogue-style guidance. New mood types can be added as content rows without changing the schema. `public.npcs.current_mood_id` references this table and defaults to `neutral`; `mood_updated_at` records the latest base-mood update.

### Per-player relationship

Create `public.npc_relationships` with a unique `(user_id, npc_id)` key:

- `familiarity`: integer from 0 to 100; normally increases through meaningful interaction.
- `affinity`: integer from -100 to 100; changes through bounded social events.
- `interaction_mood_id`: nullable FK to `mood_types`.
- `mood_expires_at`: nullable expiry for the personal reaction.
- `last_interaction_at` and standard timestamps.

Relationship labels are derived, not stored:

- `strained`: affinity below -20.
- `stranger`: familiarity below 10.
- `acquaintance`: familiarity 10–29.
- `friendly`: familiarity 30–54.
- `friend`: familiarity 55–79.
- `close_friend`: familiarity 80 or more with non-negative affinity.

Thresholds are server-owned constants with focused tests. The existing free-text `npc_memory` table is not repurposed for scores or mood state.

## Mood Resolution

`NpcMoodService` owns all mood decisions and writes. Effective mood has three ordered layers:

1. Base mood derived from current game-local time, NPC profile, and schedule.
2. Relationship adjustment for the current player.
3. Unexpired reaction caused by the current/recent conversation.

The default schedule is:

- Morning: `neutral` or `happy`.
- 11:00–12:00: usually `hungry`, sometimes `stressed` where authored temperament permits it.
- After 16:00: usually `tired`.
- After 19:00: usually `relaxed`.
- 21:00–22:00: usually `sleepy`.

Age may shift energy, meal, and sleep windows through explicit rules. Age and gender never imply anger, friendliness, or other personality traits. Those come from authored temperament and mood rules.

Occasional moods use a stable deterministic choice seeded from NPC ID, game date, and time slot. This prevents refreshes from changing the result and limits exceptional moods to the configured one or two windows per game day. There is no cron job: mood is recomputed when NPC data is loaded or a conversation starts, and the database is updated only when the base mood changes.

The city and clock are resolved from the player's server-owned game state. Shared dialogue must never hard-code Maplewood or another city name.

## NPC Presence Schedule

NPC availability is server-authoritative and is calculated from game time in the selected city's time zone. `profile.presenceSchedule` contains:

- `timeZoneSource`: initially `player_city`.
- `weeklySlots`: one or more entries containing days of the week, local `start` and `end` times, and a `locationId`.

Schedules support multiple shifts per day, weekends, and windows that cross midnight. Authored schedules reflect each NPC's job and `dailyRoutine`; age does not implicitly decide whether an NPC works. Content validation rejects overlapping slots for the same NPC and location, invalid local times, unknown locations, empty day sets, and store shifts outside the venue's service rules.

Presence behavior:

- Street NPCs appear only during a matching schedule slot for the current map.
- Store workers use authored shifts constrained by their venue's opening hours.
- The server rejects a new conversation when the NPC is not present.
- A conversation already in progress may finish after the shift boundary; the NPC disappears after it closes.
- The client refreshes presence on map entry and when the game clock crosses a schedule boundary. The client may hide actors for presentation, but it cannot authorize interaction.
- Presence is computed on read and interaction; no cron task or periodic database write is required.
- If a store worker lacks a schedule, availability falls back to the venue's server-owned opening hours.
- If a street NPC lacks a schedule, the NPC is absent. This prevents accidental 24-hour street presence.

Time-zone conversion uses the city's stored IANA time-zone identifier and the existing server-owned game clock. Boundary behavior is start-inclusive and end-exclusive. Tests cover city time zones, game-day rollover, daylight-saving transitions, exact shift boundaries, and overnight slots.

## Relationship and Conversation Reactions

A focused server service maps verified conversation events to bounded state changes. Initial events include greeting, thanks, polite request, apology, repeated harassment, and clear insult. Unknown or ambiguous text produces no relationship change.

- Courtesy changes affinity only slightly.
- Meaningful interaction increases familiarity slowly.
- Repetition and learner mistakes are not punished.
- Clear insults can create temporary `upset` or `angry` reactions and reduce affinity.
- A recognized apology can soften the temporary reaction but cannot instantly erase accumulated negative affinity.
- Per-turn and per-day caps prevent farming or a single message causing extreme changes.
- AI-generated reply text never decides scores, rewards, purchases, or quest progress.

The relationship update and saved conversation turn occur in the same server transaction. Retries use the existing client-message idempotency key and must not double-apply social changes.

Store workers remain professional at all relationship levels. Low affinity may shorten wording, but it cannot change prices, inventory, order validity, opening hours, or the ability to complete a valid transaction.

## Dialogue Behavior

Street NPCs support deterministic questions about:

- Name, age, hometown, and available family information.
- Job, workplace, and feelings about work.
- Hobbies, food, likes, dislikes, books, music, art, pets, travel, and school.
- Current city, local places, routines, current activity, and plans.
- Wellbeing, weather, thanks, apologies, compliments, and farewells.

Keyword variants include correct English and common learner forms such as `How old you?`, `Where you from?`, and `What food you like?`. Recognition stays specific enough to avoid accidental matches. Missing profile data routes to a natural privacy/unknown response rather than fabricated detail.

Responses answer directly, usually in one or two sentences, and ask at most one relevant follow-up question. Personality, effective mood, and relationship stage alter tone but never factual content.

Store NPC small talk is brief and redirects naturally to service, for example: `My name is Mia. What can I get for you today?` Store scripts may become more natural, but their intent IDs, authoritative state changes, and safety behavior remain unchanged.

## Language Adaptation

The default response level is A2. The server combines:

- The player's stored English level.
- The current message's observable complexity.
- NPC mood and personality.

The effective level moves at most one CEFR band per turn. Mood affects sentence length and tone, not truth. Scripted dialogue uses authored variants where available; AI prompts receive only validated NPC facts, effective level, mood, relationship stage, place, and safe recent history.

When level or mood cannot be resolved, the system uses A2 and `neutral`.

## Components and Flow

- Shared schemas validate NPC profiles, mood content, and API metadata.
- Content JSON authors NPC facts and dialogue; seeding upserts validated profile and mood rows.
- `NpcMoodService` resolves and lazily updates base/effective mood.
- `NpcRelationshipService` owns per-player scores and temporary reactions.
- `NpcPresenceService` resolves schedule windows and guards new interactions.
- `DialogueService` resolves authored intents and interpolates only allowlisted context values.
- `ConversationsService` orchestrates the transaction and keeps quest/store authority unchanged.
- `NpcPromptService` receives the same validated database facts used by scripts, preventing script/AI contradictions.

Flow for a message:

1. Load player, NPC, place/city, profile, relationship, and game time.
2. Verify that the NPC is present when opening a new conversation.
3. Resolve effective mood and response level.
4. Run authoritative quest/store dialogue first.
5. Run deterministic everyday intents and render database-backed facts.
6. Use AI only under the existing fallback policy.
7. Classify bounded social events, save the turn, and idempotently update relationship state.

## Failure and Safety Behavior

- Invalid profile or mood content fails validation before seeding.
- Missing runtime profile fields never produce invented facts.
- Missing mood rows fall back to `neutral` without granting any game state.
- Missing or invalid presence data fails closed for street NPC interaction.
- Failed relationship writes roll back with the conversation transaction.
- Player input cannot submit mood, relationship scores, facts, rewards, or intent metadata.
- Private player data is not copied into NPC profiles, logs, or prompts.

## Verification

- Schema tests for valid, missing, and malformed JSONB profile fields.
- Seed and forward-migration tests for mood types, profile data, and FKs.
- Table-driven dialogue cases covering natural questions, learner mistakes, boundaries, and missing facts.
- Per-NPC coverage proving names/jobs/profile facts come from seeded data and are not hard-coded.
- Time-boundary mood tests, including age-adjusted schedules and stable daily variation.
- Presence tests for multiple shifts, overnight slots, selected-city time zones, daylight-saving transitions, and open-conversation grace behavior.
- Relationship tests for caps, expiry, apology behavior, professional store behavior, and message replay idempotency.
- Regression tests for quests, tickets, shop prices, ordering, payment, rewards, and conversation history.
- Content validation, server typecheck, focused unit tests, and relevant integration tests before completion.

## Delivery Strategy

Implement as small reversible slices:

1. Profile and mood schemas/content plus forward migration.
2. Database-backed context, deterministic base mood, and authoritative presence schedules.
3. Expanded everyday intents and natural street/store wording.
4. Per-player relationships and conversation reactions.
5. Adaptive language metadata and AI prompt alignment.

Each slice keeps existing quest and store behavior working and is verified before the next slice.
