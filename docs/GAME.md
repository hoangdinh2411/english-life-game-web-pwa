# GAME — product behavior

## The game
Life Abroad teaches English through a small 2D role-playing game. Players move
into the fictional town of **Maplewood**, speak with NPCs, and solve practical
problems. English is a tool to accomplish a task, not a multiple-choice test.

## Content and MVP
- Authenticated character creation: select a starter city/avatar, enter a name,
  then start; resume existing characters from the server.
- Authored content in `content/seed/`: one town; **Mia** (café), **Mr. Brown**
  (housing), **Sam** (bank); **five later quests** and their ordered steps/rewards.
  These quests are *seeded data*, **not yet playable server quest gameplay**.
  The **station arrival quest**, receptionist, station/street locations and
  bus-ticket dialogue are also authored and seeded. The server dialogue engine
  recognizes requests with NPC → role → global fallback. Ordered server arrival
  steps, saved ticket entitlement and one-time rewards are implemented; the
  scripted conversation API is implemented; authenticated client connection is pending.
- The existing Phaser **train station** is playable local practice with a
  receptionist and two passengers, sample conversations, Coach feedback,
  movement/portals, recorded audio, and optional browser speech-to-text.
  Its current receptionist asks about an **ID card**, and its street exit is
  unlocked by that conversation—not by a bus ticket. This is **legacy practice
  behavior**, not the new opening quest. It works without an account and gives
  **no XP, coins, ticket ownership or saved progress**.
- Not in this MVP slice: native apps, multiplayer, spending coins,
  energy consumption/refill, subscriptions, general AI chat, deep NPC memory.

## First full quest loop (planned: station → town streets)
Arrive at the **train station** → approach the **receptionist** → ask how to
reach town and request a **bus ticket** → type a reply → recognize its **intent**
→ advance ordered arrival-quest steps → offer a gentle correction →
**server** records the bus ticket → use the ticket to leave the station for
**Maplewood Town Street** → complete the arrival quest → **server** awards
XP/coins **once** → ticket, quest state and rewards survive reload/sign-in.

The ticket can be a server-verified **arrival-quest entitlement**; do not build
an entire inventory system just for this item. Speech input stays optional.
The café/Mia quest comes **after** the player reaches the town streets.
Server quest state and the guarded street-exit API are implemented. This full
playable loop still needs client wiring; see `TASKS.md`.

## Learning and dialogue rules
- **Meaning first:** understandable but imperfect English can complete a step.
  Do not punish learners with red marks or block progress for minor grammar.
- NPCs respond in natural corrected English. Detailed coaching is optional via
  the Coach UI; don't assert an unvalidated grammar score or CEFR certification.
- CEFR A1–C1 can guide dialogue complexity. Automatic level changes and XP
  thresholds have **not** been approved.
- Scripted quest dialogue is deterministic and usable without AI. Lookup
  priority: NPC-specific → role → global. Intent keywords/next-node links come
  from validated dialogue JSON; personality changes wording, not rewards.
- AI free chat, corrections history and vocabulary journal are future features.
  AI chat must not grant quests/rewards. Any AI caps/costs are still undecided.
- Typing must always work. Browser speech is optional, never required.

## Source of truth
- `content/seed/{town,avatars,npcs,quests}.json`: authored world/quest data.
- `content/dialogue/*.json`: server-scripted dialogue, validated then seeded
  into PostgreSQL `dialogue_nodes`; server uses cached nodes.
- `packages/shared`: shared schemas, rules and current station practice logic.
- `apps/game/assets` and existing game code: local train-station practice
  and station/street visuals, not yet the server-backed ticket journey.
- `docs/TECH.md`: implemented API, architecture and runtime rules.

Future asset delivery through Supabase Storage is a **proposal**, not the
current source of truth; don't move working bundled assets by default.
