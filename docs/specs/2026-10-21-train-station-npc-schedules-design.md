# Train Station NPC Schedules and Receptionist Movement

## Goal

Make the train station feel active at different times of day while fixing the
current mismatch between the passenger names, character art, and voices.

This change applies to the existing Phaser train-station experience. It does
not add rewards, persistence, inventory, or new server-controlled progression.

## Passenger roster

Replace the displayed identities Peter and Emma with three passenger
identities. Each identity must have a name and configured voice that match the
gender presentation of its assigned portrait and walking sprite.

The first implementation will reuse compatible bundled character artwork. It
will not generate or require three new sprite sheets. Existing station asset
keys may remain internal implementation details, but the player-facing names,
portraits, voices, and dialogue must describe one consistent identity.

Passenger definitions will be data-driven and contain:

- stable NPC ID;
- display name;
- visual/portrait asset key;
- voice configuration;
- station spawn point and bounded movement route;
- one or more appearance windows;
- dialogue role or script key.

Exactly three passenger definitions are in scope. Five passengers and an
open-ended crowd system are explicitly out of scope.

## Schedule behavior

Passenger visibility is derived from the existing game clock when it is
available. Local practice uses a deterministic station-time input so tests and
offline behavior do not depend directly on the wall clock.

The three schedules cover morning, daytime, and evening. Their windows may
overlap, but the selector must expose no more than two passengers at once. A
schedule boundary affects only world presence: an active conversation may
finish before that NPC is removed.

Schedule selection is a pure function of station time and passenger data. It
must not change quests, rewards, saved location, or server state.

## Receptionist behavior

The receptionist remains visible for every station time and keeps the current
receptionist ID so arrival and tutorial hooks continue to work.

Instead of standing at one exact point, the receptionist follows a short,
bounded patrol around the information desk. The route must stay inside the
desk area, avoid portals and player paths, and never imply that the desk is
unattended. Interaction or a paused world stops the receptionist immediately;
movement resumes from the current route position when gameplay resumes.

The receptionist is excluded from the passenger schedule selector and cannot
be removed by an empty presence allowlist.

## Client structure

Keep the change within the station feature boundary:

- a station roster module owns passenger and receptionist definitions;
- a pure schedule selector returns active station NPCs for a supplied time;
- the Phaser station scene creates, removes, and updates actors from that
  selected roster;
- the existing NPC motion layer owns the receptionist's bounded patrol and
  conversation pause behavior;
- dialogue UI resolves names and portraits from the same roster instead of a
  separate hard-coded list.

The shared `StationSpeaker` contract and local scripted dialogue routing will
be extended only as required for the third passenger. Existing receptionist
dialogue and arrival behavior remain unchanged.

## Failure and transition behavior

- Missing or invalid station-time data falls back to the deterministic daytime
  roster rather than hiding every passenger.
- A missing optional passenger asset skips that passenger and records the
  existing non-sensitive diagnostic; it must not prevent the map or
  receptionist from loading.
- Actor changes happen only when the active schedule bucket changes, avoiding
  per-frame creation and teardown.
- NPCs are not removed while their conversation is open; roster reconciliation
  occurs after the conversation closes.

## Content and interface updates

Update station tutorial wording so it does not promise exactly two passengers.
Update name, portrait, voice, dialogue, and sprite mappings together. Remove
all player-facing references to Peter and Emma from the station experience.

No database migration or remote API change is required for this local station
roster.

## Verification

Focused automated checks must prove:

- morning, daytime, and evening boundaries select the expected passengers;
- no time bucket exposes more than two passengers;
- the receptionist is present for every tested time;
- each passenger's name, portrait presentation, and voice configuration agree;
- the receptionist patrol remains inside its bounded walkable route;
- conversation and world pause stop NPC movement;
- closing a conversation safely reconciles a crossed schedule boundary;
- existing receptionist directions and station portal behavior still pass.

Run the affected game and shared-package tests, TypeScript checks, and a
production game build. Manually inspect the station at narrow and wide browser
sizes and verify that NPCs do not block the player, desk, or exits.

## Out of scope

- new generated character art;
- five-passenger crowds;
- server persistence for local-practice schedules;
- changes to rewards, arrival-quest ordering, tickets, or English Review;
- free roaming outside the receptionist's desk area.
