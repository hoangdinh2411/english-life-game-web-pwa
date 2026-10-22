# Controlled NPC Presence and Venue Configuration

## Goal

Make existing locations feel populated without changing their NPC selection every
time the player crosses a portal. Service NPCs remain dependable, while
passengers and customers vary predictably by game day, location, and time of
day.

This design applies to the train station and current shop interiors. It defines
an extension contract for additional stores and maps without building unused
store-specific behavior in advance.

It does not change quests, rewards, persistence authority, store opening hours,
or remote dialogue behavior.

## NPC categories

Every configured NPC has one presence category:

- `service`: a required worker such as a receptionist, seller, or manager;
- `ambient`: a passenger or customer selected from a location-specific pool;
- `scheduled`: an authored NPC whose existing schedule decides its presence.

An NPC cannot belong to more than one category within a location.

Service NPCs are Phaser actors, not characters painted into a map background.
They can animate, interact, and follow a bounded route. Their artwork is bundled
with the game build so their availability does not depend on a dynamic map-pack
upload. Browser and PWA caching may avoid repeated network transfer after the
initial build asset is loaded.

Ambient artwork may continue to use the existing dynamic map-pack flow. A
missing optional ambient asset skips that NPC and records the existing
non-sensitive diagnostic; it must not prevent the map or required service NPCs
from loading.

## Deterministic controlled randomness

Ambient selection uses deterministic seeded randomness. The seed is derived
from:

- the selected country's local game date;
- the location ID;
- the current time bucket.

The initial shared buckets are `morning`, `daytime`, and `evening`. Their exact
boundaries live in one shared definition rather than being repeated by each
venue.

For a given seed and configuration, the selector returns the same roster. Going
through a portal repeatedly during one bucket therefore does not reroll the
location. The roster may change when the game date or bucket changes, so the
same location does not remain identical throughout every visit and day.

The selector is a pure function. It must not read the wall clock directly or
change quests, rewards, saved location, relationships, or server state. Invalid
or missing time data falls back to a documented deterministic daytime input.

## Shared venue contract

Stores use one validated configuration shape rather than class inheritance or
separate selection algorithms:

```ts
type VenueNpcConfig = {
  locationId: LocationId;
  serviceNpcIds: readonly NpcId[];
  optionalStaffNpcIds: readonly NpcId[];
  ambientNpcPool: readonly NpcId[];
  ambientCount: {
    min: number;
    max: number;
  };
  spawnZoneIds: readonly SpawnZoneId[];
  exclusionZoneIds: readonly ExclusionZoneId[];
  timeBuckets: readonly TimeBucket[];
};
```

The final implementation may derive these TypeScript types from the validated
schema, but it must preserve this separation of responsibilities:

- the shared contract defines supported configuration;
- each venue supplies data for its own roster, limits, and zones;
- one selector implements seeded ambient selection;
- venue-access rules remain the authority for opening hours and portal access;
- movement remains responsible for routes and collision-safe positions.

The venue registry maps a location ID to its configuration. Adding a future
store requires NPC definitions, venue configuration, spawn and exclusion zones,
and registry registration. It must not require modifying the selection
algorithm.

Validation rejects at least:

- minimum counts greater than maximum counts;
- negative counts or a maximum larger than the ambient pool;
- duplicate NPC IDs;
- an NPC assigned to conflicting categories;
- unknown NPC, location, bucket, or zone IDs;
- a location with ambient NPCs but no usable spawn zone.

Opening hours are not copied into this contract. Closed stores retain the
current behavior: the player cannot enter them.

## Location behavior

### Train station

The receptionist remains present in every time bucket and keeps the current
receptionist ID so arrival and tutorial hooks continue to work. The receptionist
follows a short bounded patrol around the information desk. Interaction or a
paused world stops movement immediately, and movement resumes from the current
route position when gameplay resumes. The route stays clear of portals, the
desk interaction point, and primary player paths.

The station defines exactly three passenger identities. Each identity has one
stable NPC ID and consistent display name, portrait, walking sprite, voice,
dialogue routing, spawn options, and bounded movement route. The player-facing
Peter and Emma identities are removed.

Each bucket deterministically selects one or two passengers. No bucket exposes
more than two passengers, and the receptionist is not counted toward that
limit. Passenger spawn positions must not block portals, primary paths, or the
receptionist interaction area.

### Current cafés

The seller or manager is a required service NPC while the venue is accessible.
Existing assistants remain service NPCs in the first implementation because
randomly removing staff could invalidate dialogue or quest assumptions.

Customer NPCs are ambient. Each café provides its own customer pool, count
limits, and customer-only zones. Customers cannot block the service counter,
entrance, or primary walking paths.

### Current clothes shop

The seller or manager is a required service NPC while the venue is accessible.
The existing assistant remains a service NPC in the first implementation.

Customer NPCs are ambient. The shop provides its own pool, count limits, and
customer-only zones. Customers cannot block the counter, entrance, fitting
area, or primary walking paths.

### Town Street

Town Street keeps its existing authored weekly schedules and routes. Its NPCs
may use the common presence result contract where compatible, but this change
does not replace authored schedules with random hiding. Controlled street
randomness is deferred until there is a sufficiently large resident or visitor
pool and an explicit product requirement.

## Runtime data flow

1. Existing venue-access logic decides whether the player may enter a store.
2. When a location loads, the registry resolves its NPC configuration.
3. The presence selector receives the configuration, game date, and time
   bucket.
4. Required service NPCs are included, then ambient NPCs are selected with the
   deterministic seed.
5. The Phaser scene creates actors and reconciles them only when the effective
   seed or configuration changes, not every frame or portal entry.
6. Movement applies the configured spawn, route, and exclusion constraints.
7. Dialogue UI resolves name, portrait, and voice from the same NPC definition
   used by the world actor.

An NPC with an open conversation is not removed when a bucket boundary is
crossed. Reconciliation completes after the conversation closes. Pausing the
world stops all NPC movement.

## Failure behavior

- Invalid authored configuration fails content validation with the affected
  location and field identified.
- Missing or invalid runtime time data uses the deterministic daytime fallback.
- A missing optional ambient asset skips that NPC without blocking the location.
- A required service NPC is never silently treated as optional. Failure to load
  its bundled definition or asset produces a visible location-load error rather
  than opening a store without its required worker.
- An empty or undersized ambient pool produces as many valid ambient NPCs as are
  available and records a non-sensitive diagnostic. It never duplicates an NPC
  to satisfy the configured minimum.
- Diagnostics must not include tokens, conversation text, or private player
  data.

## Content and interface updates

The station tutorial must not promise exactly two passengers. Station names,
portraits, voices, dialogue, and sprites must be updated together for the three
passenger identities.

The shared station speaker and conversation contracts are extended only as
needed for the third passenger. Existing receptionist dialogue, arrival
behavior, quest order, store access, and portal behavior remain unchanged.

Durable product behavior belongs in `docs/GAME.md`, while the shared venue
contract and extension steps belong in `docs/TECH.md`. Those maintained docs
should be updated once the implementation establishes the final module and
schema names; they must not duplicate this specification verbatim.

## Verification

Focused automated checks must prove:

- identical inputs and seed produce an identical roster;
- changing the date or time bucket can produce a different valid roster;
- ambient counts remain within each location's configured bounds;
- service NPCs are present for every valid roster;
- invalid and conflicting configurations are rejected;
- the station exposes one or two of its three passengers and never more than
  two;
- passenger name, portrait presentation, sprite, voice, and dialogue identity
  agree;
- the receptionist patrol remains inside its bounded walkable route;
- ambient actors remain inside permitted zones and outside exclusion zones;
- conversation and world pause prevent removal or movement as appropriate;
- closing a conversation safely reconciles a crossed bucket boundary;
- closed stores remain inaccessible;
- required bundled service assets do not depend on the dynamic map-pack path;
- existing receptionist directions, arrival flow, quests, shop conversations,
  and portals continue to pass.

Run focused game and shared-package tests, TypeScript checks, and a production
game build. Manually inspect affected locations at 320 px, 375 px, and a wider
viewport. Verify that actors do not block the player, counters, desks, or exits.
Real Android and iOS installation behavior remains untested unless checked on
physical devices.

## Out of scope

- generating new character artwork;
- an unbounded crowd simulation;
- randomizing service staff required by dialogue or quests;
- changing store opening hours or allowing entry while closed;
- replacing Town Street's authored weekly schedules;
- server persistence for local-practice passenger selection;
- changes to rewards, arrival-quest ordering, tickets, or English Review;
- implementing configuration for stores or maps that do not yet exist.
