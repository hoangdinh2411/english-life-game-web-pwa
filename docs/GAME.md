# GAME — product behavior

## The game

Life Abroad teaches English through a small 2D role-playing game. Players move
into the fictional town of **Maplewood**, speak with NPCs, and solve practical
problems. English is a tool to accomplish a task, not a multiple-choice test.

## Content and MVP

- Authenticated character creation: select a starter city/avatar, enter a name,
  then start; resume existing characters from the server.
- Authored content in `content/seed/`: one town; **Mia** (café), **Mr. Brown**
  (housing), **Sam** (bank); **Your First Coffee** and four later quest
  definitions. The four later quests remain seeded data. The café quest is
  playable after arrival: greet Mia → order a drink → confirm/pay → receive its
  reward once. The waiter chats and refers orders to Mia; both staff give
  receptionist directions. Progress, payments and rewards survive reload.
  The **station arrival quest**, receptionist, station/street
  locations and bus-ticket dialogue are also authored and seeded. The server
  dialogue engine recognizes requests with NPC → role → global fallback. Ordered
  server arrival steps, saved ticket entitlement and one-time rewards are
  implemented; the scripted conversation API and authenticated station/street
  connection are implemented. Typed receptionist replies use the server;
  entering Town Street waits for the saved ticket use and restores the saved
  location on reload.
- The existing Phaser **train station** is playable local practice with a
  receptionist and two passengers, sample conversations, Coach feedback,
  movement/portals, recorded audio, and optional browser speech-to-text. Its
  current receptionist asks about an **ID card**, and its street exit is
  unlocked by that conversation—not by a bus ticket. This is **legacy practice
  behavior**, not the new opening quest. It works without an account and gives
  **no XP, coins, ticket ownership or saved progress**.
- The signed-in game menu supports immediate café consumption, shirt purchases,
  separate hair/shirt/trouser colors. The battery HUD has an icon-only Sleep
  button, available only below 50% energy (enforced by the server). Hover/focus
  explains the action; on touch screens, tap once for help and again to sleep.
  Sleep advances eight game hours, fades out/in over about four seconds, then
  displays the saved energy with a gradual refill; reduced motion skips
  animation. Energy, wallet, wardrobe and the independent 2× UTC game clock are
  saved on the server. Local practice remains free and does not change saved
  life.
- Not in this MVP slice: native apps, multiplayer, subscriptions, general AI
  chat, deep NPC memory.

# Art Rules (Chibi 2D, western style)

- Tile size: **32x32 px**. Character sprite: **32x48 px**, 4 directions, 4-frame
  walk cycle.
- Portrait (for dialogue): **256x256 px**, 3 moods minimum (neutral, happy,
  confused).
- Format: PNG with transparency. Sprite sheets are packed (TexturePacker or
  similar) into atlas + JSON.
- Naming: `type_name_variant.png` (example: `npc_mia_walk.png`,
  `tile_street_01.png`, `ui_button_primary.png`).
- Palette: warm, soft colors; keep a shared palette file `palette.json`.
- Audio: OGG (and MP3 fallback), music loops under 1 MB each, voice lines 64
  kbps mono.
- Load assets per town (lazy). Never load all assets at start.
- Until real art exists, use simple placeholder rectangles with the same sizes.

## First full quest loop (station → town streets)

Arrive at the **train station** → approach the **receptionist** → ask how to
reach town and request a **bus ticket** → type a reply → recognize its
**intent** → advance ordered arrival-quest steps → offer a gentle correction →
**server** records the bus ticket → use the ticket to leave the station for
**Maplewood Town Street** → complete the arrival quest → **server** awards
XP/coins **once** → ticket, quest state and rewards survive reload/sign-in.

The ticket can be a server-verified **arrival-quest entitlement**; do not build
an entire inventory system just for this item. Speech input stays optional. The
café/Mia quest comes **after** the player reaches the town streets. Server quest
state, the guarded street-exit API and client wiring are implemented. The
arrival UI shows saved ordered progress, ticket receipts and optional Coach
feedback. Connection failures preserve the reply for an idempotent retry; a live
offline session keeps its draft in memory and disables remote actions until
reconnection. Local `/practice` stays available without saved rewards.

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
- `apps/game/assets` and existing game code: shared station/street visuals,
  independent local practice and the authenticated server-backed ticket journey.
- `docs/TECH.md`: implemented API, architecture and runtime rules.

Future asset delivery through Supabase Storage is a **proposal**, not the
current source of truth; don't move working bundled assets by default.
