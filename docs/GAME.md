# GAME — product behavior

## The game

Life Abroad teaches English through a small 2D role-playing game. Players start
their new life in a country, speak with NPCs, and solve practical problems.
English is a tool to accomplish a task, not a multiple-choice test.

## Content and MVP

- Authenticated character creation stays on one first-run route with three
  consecutive steps: explicitly select one authored country, choose one of two
  image-only player characters, then enter a name. Nothing is preselected and
  Sweden is not a fallback. The selected character is immutable after creation
  and controls the saved-game walking sprite and player portraits.
  The server assigns the country's internal starter city; players never choose
  or see the city hierarchy. If a saved character has no valid country or
  starter city, the player returns to first-run setup.
- Gameplay location labels, NPC scripted dialogue, AI context and country-local
  time use the authenticated character's selected country. Country-less local
  practice uses neutral wording and never claims a default country.
- Authored content in `content/seed/`: one town; **Mia** (café), **Mr. Brown**
  (housing), **Sam** (bank); **Your First Coffee** and four later quest
  definitions. The four later quests remain seeded data. The café quest is
  playable after arrival: greet Mia → order a drink → confirm/pay → receive its
  reward once. The waiter chats and refers orders to Mia; both staff give
  receptionist directions. Progress, payments and rewards survive reload. The
  **station arrival quest**, receptionist, station/street locations and
  bus-ticket dialogue are also authored and seeded. The server dialogue engine
  recognizes requests with NPC → role → global fallback. Ordered server arrival
  steps, saved ticket entitlement and one-time rewards are implemented; the
  scripted conversation API and authenticated station/street connection are
  implemented. Typed receptionist replies use the server; entering Town Street
  waits for the saved ticket use. Reload restores the player's last exact place
  (station, street, café, clothes shop or tax office), its parent map and the player's
  position inside it.
- Player movement updates the latest private location checkpoint in browser
  `localStorage`; it does not call the API for every movement sample. The client
  debounces server sync for five seconds, syncs place changes immediately and
  flushes when the tab moves to the background. Pending location data is scoped
  by account and cleared on sign-out. This is recovery for the current online
  game, not general offline gameplay. If broader offline state is approved
  later, replace the single local checkpoint with a versioned IndexedDB record
  (and an outbox only for operations that genuinely need ordered replay).
- Town Street is a larger, camera-following plaza map with connected paths and
  added library, pharmacy, florist, post office, bakery and house buildings
  around its original plaza. It includes Corner Cup Café, a separately named
  second café that reuses the seller/catalog flow and has an assistant and three
  customer NPCs. Players stay on the marked streets and plaza paths; building
  footprints, the fountain, and planters block movement.
- The Tax Office opens from Town Street from 08:00–16:00 organization time.
  Marcus and Nadia are its named male and female staff; both are identified as
  Tax Office Staff and can open the same conversation flow. A closed entrance
  shows the office hours.
- Town Street has 15 named residents with distinct jobs and authored profiles,
  portrait links, and road patrol routes. Each route has 12–14 waypoints, and
  residents can be approached for scripted small talk about everyday topics.
  Walking NPCs continue through route waypoints without timed stops; nearby
  interaction, conversations and world pause still stop movement. Three
  residents stay within each outer neighborhood (northwest, northeast, southwest
  and southeast); three others occupy the middle streets/plaza. Separate
  west/east routes keep the lower-left populated as residents walk. NPC profiles
  and route data live in `content/seed/street-npcs.json`; resident sprite art
  downloads by nearby atlas row as the player approaches, so distant character
  artwork stays unloaded until needed. Portrait links can be changed without
  rewriting gameplay code.
- Every NPC has a strict version-1 authored profile. Optional personal facts
  include age, hometown, family, hobbies, favourite food, likes/dislikes,
  conversation topics, temperament and daily routine. Dialogue receives only
  stored facts and must not invent a missing fact.
- NPC base moods come from an editable database catalog and are resolved lazily
  from the saved game clock in the player's selected country time zone. Authored
  rules may enable morning happiness, midday stress, sleepiness, timing shifts
  or deterministic exceptional moods; age only shifts meal, energy and sleep
  timing and never implies anger or friendliness.
- Authored weekly NPC schedules use the selected country's local game time and
  support split and overnight shifts. Street residents without schedules are
  absent. Station passengers and shop customers use deterministic controlled
  presence based on game date, location and morning/daytime/evening bucket, so
  repeated entry does not reroll a location. Required service staff remain
  present while an accessible venue is open, and conversations already in
  progress may finish after a presence boundary.
- Each player builds a separate relationship with each NPC. Familiarity and
  affinity change slowly from explicit greetings, thanks, polite requests,
  apologies and insults. Ambiguous language and learner mistakes do not count.
  Insult reactions expire in game time, apologies soften rather than erase
  negative affinity, and shop rules and prices never depend on relationship.
- NPCs answer everyday questions with validated profile and location facts,
  including common learner forms such as “How old you?” and “Where you from?”.
  Missing facts receive a natural non-answer instead of invented detail. Shop
  NPCs keep small talk brief and redirect to service without changing orders,
  prices or quest behavior.
- Service conversations are session-only working state, not durable chat
  history. Seller, shop-assistant, waiter and Tax Office staff messages are
  removed when their dialogue closes and are purged again when the game starts;
  reopening begins a fresh conversation. Server-owned outcomes such as a paid
  order or issued ID card remain saved. Resident/social NPC history and the
  quest-critical station receptionist history remain durable.
- NPC replies default to CEFR A2 when learner data is unavailable. Otherwise,
  the server combines the stored learner level with observable input complexity
  and may adjust by at most one CEFR band for that turn. Mood and relationship
  stage change tone and length only; they never change facts, prices or state.
  Speech uses only styles supported by the selected provider voice and falls
  back to neutral delivery.
- Shop and station NPCs have individual names. Venue hours use game time:
  organizations 08:00–16:00, stores 08:00–14:00 and workplaces 07:00–17:00. The
  current playable map gates its store interiors; closed entrances show the
  owner's dialogue with opening hours. The pause menu does not list opening-hour
  schedules.
- The existing Phaser **train station** is playable local practice with
  receptionist Ruth and one or two deterministically selected passengers from
  Sofia, Elias and Ingrid, sample conversations, movement/portals, recorded
  audio, and optional browser speech-to-text. Its current receptionist asks
  about an **ID card**, and its street exit is unlocked by that conversation—not
  by a bus ticket. This is **legacy practice behavior**, not the new opening
  quest. It works without an account and gives **no XP, coins, ticket ownership
  or saved progress**.
- Signed-in players open their character profile by selecting the player card in
  the game HUD. The profile shows saved XP, wallet and energy. The non-pausing
  game menu opens English Review, the five-page movement tutorial, sign-out,
  return-to-game and Settings; these utility overlays capture player input while
  NPC movement and game time continue. The tutorial appears once on the first
  ready signed-in world and can be replayed from page 1 through the menu. Its
  pages play cached Azure Neural narration when Sound is enabled; local practice
  remains text-only and offline. Café
  orders stay in seller conversations. Below 1024px the card is compact, Goals
  includes its status badge, and the normal desktop HUD keeps its existing
  layout. Dialogue Settings remain reachable during conversations; full profile
  details include appearance. Quick rest is
  available at 0–29% energy, restores 50 points capped at 100, never changes
  game time, and blocks play for five seconds after server success. Reduced
  motion shortens only the fades. Energy, wallet and appearance are saved on the
  server. Game time comes from the selected country's shared, immutable 6× world
  clock. Local practice remains free and does not change saved life.
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
**intent** → advance ordered arrival-quest steps → model natural English in the
NPC reply → **server** records the bus ticket → use the ticket to leave the
station for **Town Street** → complete the arrival quest → **server** awards
XP/coins **once** → ticket, quest state and rewards survive reload/sign-in.

The ticket can be a server-verified **arrival-quest entitlement**; do not build
an entire inventory system just for this item. Speech input stays optional. The
café/Mia quest comes **after** the player reaches the town streets. Server quest
state, the guarded street-exit API and client wiring are implemented. The
arrival UI shows saved ordered progress and ticket receipts. Connection failures
preserve the reply for an idempotent retry; a live offline session keeps its
draft in memory and disables remote actions until reconnection. Local
`/practice` stays available without saved rewards.

## Learning and dialogue rules

- **Meaning first:** understandable but imperfect English can complete a step.
  Do not punish learners with red marks or block progress for minor grammar.
- When the learner's meaning is clear, authenticated NPCs may weave the natural
  English form into their reply once without announcing
  a correction, explaining grammar or interrupting the conversation. This
  shared recast happens only after authoritative intent handling, never rewrites
  ID-card identity answers or confirmations, and harmless errors may be ignored.
- CEFR A1–C1 guides per-turn dialogue complexity. This does not persist an
  automatic level promotion; promotion rules and XP thresholds remain
  unapproved.
- Scripted quest dialogue is deterministic and usable without AI. Lookup
  priority: NPC-specific → role → global. Intent keywords/next-node links come
  from validated dialogue JSON; personality changes wording, not rewards.
- A future **English review** will be a player-curated notebook. Players may
  save useful NPC lines or their own lines deliberately; it will not
  automatically collect corrections or every conversation. It is not exposed
  until saving and persistence are implemented.
- AI free chat is a future feature. AI chat must not grant quests/rewards. Any
  AI caps/costs are still undecided.
- Typing must always work. Browser speech is optional, never required. While
  recording, a waveform replaces the text field; Stop keeps the transcript,
  while the × action cancels recording and clears it.
- NPC conversations use a short farewell sequence. The first clear player
  farewell prompts the NPC to ask whether the player will return tomorrow. After
  the player's answer, the NPC says goodbye; when that line finishes, the player
  can end the conversation or keep talking. The goodbye intent recognizes common
  forms such as “bye,” “see you,” “I have to go,” and “I’m leaving.”

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
