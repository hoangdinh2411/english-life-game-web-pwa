# TASKS — one small board

Current client: **Vite + React DOM + TypeScript + Phaser 4 + PWA (D16)**.
Native/Expo/WebView tasks are retired. The app and the seed content are not
proof that planned server quest/chat engines have been implemented.

## How to work

- Complete only the task the user requested. If the user explicitly says
  "continue" without a task, select the first unchecked **NOW** item.
- Inspect code first; change the smallest set of files; test what changed. New
  client features go under `src/features/<feature>`; new server capabilities go
  in NestJS `src/modules/<domain>`. Migrate legacy folders only when needed by
  the task; don't do a standalone folder reshuffle or create empty layers.
- Don't create branches/commits, planning documents, reports, progress logs or
  new agent sessions automatically. Add necessary source/tests/migrations.
- Mark a task done here **only after verification**. Reply with a short summary,
  checks and blockers; do not start the following task automatically.

Example task request:

```text
Read MASTER_PROMPT.md and implement task T4 from docs/TASKS.md.

Follow all applicable project instructions.

Complete the task, verify the acceptance criteria, update its status if verified, report briefly, and stop.

Do not create Git commits. Just suggest a commit message for me; I will commit manually.
```

## DONE — existing foundation (verified in supplied project history)

- [x] Monorepo and Vite/PWA client (D16); responsive browser onboarding.
- [x] Supabase SDK auth and NestJS JWT verification.
- [x] R1–R4: health, DB/access, onboarding options, `/me`, character creation.
- [x] T2: migrations 001–004; authored NPC/quest/dialogue seed.
- [x] T3: Zod content validation and invalid-content tests.
- [x] Local Phaser station practice, three station NPCs, optional browser
      speech, recorded voice, Coach, portals, public-only PWA precache; **no
      rewards**. The station's current ID-card directions unlock the street
      locally; this remains separate from the server-owned arrival quest state.

## NOW — Slice 1: arrival at the train station

**Goal:** an authenticated player speaks English with the **station
receptionist**, receives a **bus ticket**, takes the station exit to **Maplewood
Town Street**, and finishes the arrival quest. The **server** saves the ticket,
ordered steps, and one-time XP/coins reward across reload/sign-in. Intent
recognition and gentle Coach feedback support typed answers (optional speech).
**Server dialogue, conversation API, quest state and station/street wiring are
implemented, including chat, optional Coach, ticket receipts and saved progress.** Keep `/practice` reward-free.

- [x] **T4 — Station dialogue engine and content.** Author/validate/seed the
      receptionist NPC, bus-ticket quest and scripted dialogue in `content/`;
      load/cache `dialogue_nodes`, recognize polite requests for a ticket and
      town directions, apply NPC → role → global fallback. Test intent matching,
      precedence, misunderstanding and safe fallback. Reuse shared code where
      suitable; don't change the independent practice flow yet.
- [x] **T5 — Arrival quest and ticket state.** Server-owned ordered steps: greet
      receptionist → ask how to reach town/request a bus ticket → obtain ticket
      → use it to enter Town Street. Persist a ticket/exit entitlement in quest
      progress (no general inventory needed), guard street access, and
      transactionally grant XP/coins **on ce** on quest completion. Test out-of-
      order steps, repeat requests, race conditions and reloads.
- [x] **T7 — Scripted conversation API.** Create conversation and append-only
      messages; connect receptionist intents to ordered quest steps and ticket
      issuance; give optional non-blocking grammar corrections. Test the station
      arrival flow through the API, including replay and sign-in persistence.
- [x] **T8 — Connect the station and street.** Reuse the current Phaser train
      station and Town Street visuals; wire authenticated receptionist
      interaction and street-exit eligibility to the server ticket/quest state.
      Replace the local ID-card exit rule **only in authenticated quest mode**.
      Preserve the existing offline `/practice` scene without rewards or private
      data caching.
- [x] **T9 — Chat, ticket and quest UI.** Show typed dialogue, optional Coach,
      ticket receipt, ordered progress, clear blocked-exit messaging, and
      network/offline errors. Browser-check train station → receptionist →
      ticket → Town Street → one-time reward, plus refresh/sign-in persistence.

## NEXT — after the first playable loop

- [x] **T6 — Rate limiting.** Configurable process-local per-IP API windows;
      verified allowed/rejected calls, 429/Retry-After, header spoofing, expiry
      and peer isolation. No default cap or energy/free-chat limits.
- [ ] **First café quest with Mia.** Reuse the proven station conversation,
      intent, quest and reward systems for existing seeded “Your First Coffee”
      after the player reaches Town Street. Don't build another quest framework.
- [ ] Expand remaining authored quests from the existing seed as needed (add
      content before new framework code).
- [ ] Physical Android Chrome/iOS Safari PWA install, reopen, offline/keyboard,
      update confirmation, microphone behavior and realistic performance
      testing.

## LATER — only when explicitly requested and policies are decided

- AI free chat/SSE (T10), memory (T11), useful vocabulary journal (T12),
  tutorial/playtest deployment (T13), browser speech accuracy experiment (S0).
- Supabase Storage asset table/manifest, client download/cache and measurement:
  **proposal only**; existing local practice assets stay bundled for now.

## Open product decisions — ask only if they block the current task

- XP-to-level thresholds/CEFR promotion, coin spending, energy/free-chat limits.
- General AI/speech providers, production Auth recovery/verification policies,
  audio privacy/age/GDPR and final asset licenses.
- Starter-city expansion and final game name; technical character-name policy.
- Optional improvements: consolidate local vs server-authored dialogue, share
  suitable intent/grammar helpers, useful-vocabulary recording.

Previously approved D16 cancels **native Expo/WebView delivery**. These future
ideas are not authority to implement extra features during T4–T9. The existing
practice-mode ID-card conversation is not evidence that a bus ticket is earned
or that persistent station progression exists.
