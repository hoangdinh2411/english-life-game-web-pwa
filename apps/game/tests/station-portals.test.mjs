import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import * as navigation from '../src/gameplay/station-navigation.ts';
const { canWalk, portalAt, STATION_PORTALS, STREET_PORTALS } = navigation;

test('denied station shop entry returns to a walkable point with keyboard and pointer escape routes', () => {
  assert.equal(typeof navigation.stationStoreReturnPoint, 'function', 'closed-store return position is missing');
  for (const portal of STATION_PORTALS.filter(portal => portal.id !== 'street')) {
    const start = navigation.stationStoreReturnPoint(portal);
    assert.equal(canWalk(start), true, `${portal.id} return point must stay on the station path`);
    assert.equal(portalAt(start, STATION_PORTALS), null, 'closing the dialogue must not immediately reopen it');
    const delta = { x: portal.id === 'cafe' ? 4 : -4, y: 0 };
    assert.notDeepEqual(navigation.movePlayer(start, delta), start, 'keyboard movement can resume');
    assert.ok(navigation.findPath(start, { x: 768, y: 750 }).length > 0, 'pointer movement can reach the main aisle');
  }
});

test('Town Street uses expanded world dimensions and clamps movement to its larger playable map', () => {
  assert.deepEqual(navigation.STREET_MAP_SIZE, { width: 2304, height: 1536 });
  assert.deepEqual(navigation.clampStreetPosition({ x: 2400, y: 20 }), { x: 2232, y: 165 });
  assert.deepEqual(navigation.clampStreetPosition({ x: -20, y: 1550 }), { x: 72, y: 1477.5 });
});

test('street transition spawn positions are on valid walkable roads', () => {
  for (const arrival of ['station', 'corner_cafe']) {
    const spawn = navigation.streetSpawnPoint(arrival);
    assert.equal(navigation.canWalkStreet(spawn), true, `street spawn from ${arrival} must be walkable`);
    assert.equal(portalAt(spawn, STREET_PORTALS), null, `street spawn from ${arrival} must be outside every entry ring`);
    const route = navigation.findPath(spawn, navigation.scaleStreetPoint({ x: 768, y: 944 }), navigation.canWalkStreet, navigation.moveOnStreet);
    assert.ok(route.length > 0, `street spawn from ${arrival} can reach the river road`);
  }
});

test('a saved street position inside the station entry ring is recovered outside it', () => {
  const oldSpawn = navigation.scaleStreetPoint({ x: 768, y: 210 });
  assert.equal(portalAt(oldSpawn, STREET_PORTALS)?.id, 'station', 'the old spawn overlaps the station entry');
  const recovered = navigation.recoverStreetPosition(oldSpawn);
  assert.equal(navigation.canWalkStreet(recovered), true);
  assert.equal(portalAt(recovered, STREET_PORTALS), null, 'recovery must not immediately re-enter the station');
});

test('returning from Corner Cup spawns directly in front of the entrance without immediately re-entering', () => {
  const spawn = navigation.streetSpawnPoint('corner_cafe');
  const distanceToPortal = Math.hypot(spawn.x - navigation.CORNER_CUP_PORTAL.x, spawn.y - navigation.CORNER_CUP_PORTAL.y);
  assert.equal(navigation.canWalkStreet(spawn), true, 'the return spawn stays on the upper street');
  assert.equal(spawn.x, navigation.CORNER_CUP_PORTAL.x, 'the player appears centered in front of the ring');
  assert.ok(spawn.y > navigation.CORNER_CUP_PORTAL.y, 'the player appears on the street side of the ring');
  assert.ok(distanceToPortal > 38 && distanceToPortal <= 60, 'the player appears just outside the ring automatic entry radius');
  assert.equal(navigation.portalAt(spawn, [navigation.CORNER_CUP_PORTAL]), null, 'returning must not immediately bounce back into the café');
  const route = navigation.findPath(spawn, navigation.CORNER_CUP_PORTAL, navigation.canWalkStreet, navigation.moveOnStreet);
  assert.ok(route.length > 0, 'the player can step back into the Corner Cup entrance ring');
});

test('leaving the train station spawns outside its entry ring', () => {
  const spawn = navigation.streetSpawnPoint('station');
  assert.deepEqual(spawn, navigation.scaleStreetPoint({ x: 768, y: 255 }));
  assert.equal(navigation.canWalkStreet(spawn), true);
  assert.ok(Math.hypot(spawn.x - navigation.CORNER_CUP_PORTAL.x, spawn.y - navigation.CORNER_CUP_PORTAL.y) > 38);
  assert.equal(portalAt(spawn, STREET_PORTALS), null);
});

test('Town Street allows its street entrances but blocks buildings, trees, water and the fountain', () => {
  assert.equal(navigation.canWalkStreet(navigation.scaleStreetPoint({ x: 768, y: 210 })), true, 'station entrance path');
  assert.deepEqual(navigation.CORNER_CUP_PORTAL, { id: 'corner_cafe', label: 'Corner Cup Café', ...navigation.scaleStreetPoint({ x: 505, y: 600 }) }, 'the entrance ring is directly outside the Corner Cup doorway');
  assert.deepEqual(STREET_PORTALS.map(({ id }) => id), ['corner_cafe', 'station']);
  assert.equal(navigation.canWalkStreet(navigation.CORNER_CUP_PORTAL), true, 'Corner Cup entrance is on the road outside its storefront');
  assert.equal(navigation.canWalkStreet(STREET_PORTALS[1]), true, 'train station entrance ring is on the north road');
  assert.equal(navigation.portalAt(navigation.CORNER_CUP_PORTAL, [navigation.CORNER_CUP_PORTAL])?.id, 'corner_cafe', 'standing at the doorway activates the café portal');
  for (const approach of [{ x: 150, y: 620 }, { x: 505, y: 620 }, { x: 1100, y: 620 }, { x: 1400, y: 620 },
    { x: 230, y: 855 }, { x: 600, y: 855 }, { x: 1080, y: 855 }]) {
    assert.equal(navigation.canWalkStreet(navigation.scaleStreetPoint(approach)), true, `storefront approach should be walkable at ${approach.x},${approach.y}`);
  }
  for (const obstruction of [
    { x: 768, y: 420 }, // central fountain
    { x: 100, y: 180 }, // Library
    { x: 500, y: 220 }, // Tax Office
    { x: 1030, y: 220 }, // Police
    { x: 1400, y: 180 }, // Workplace
    { x: 150, y: 500 }, // Clothes
    { x: 505, y: 500 }, // Corner Cup Cafe
    { x: 1080, y: 500 }, // Restaurant
    { x: 1400, y: 500 }, // Supermarket
    { x: 230, y: 750 }, // Bank
    { x: 600, y: 750 }, // Hospital
    { x: 1080, y: 750 }, // Stationery Shop
    { x: 500, y: 990 }, // waterfront
  ]) {
    assert.equal(navigation.canWalkStreet(navigation.scaleStreetPoint(obstruction)), false, `blocked at ${obstruction.x},${obstruction.y}`);
  }
});

test('Town Street blocks street furniture, planted beds, and storefront patio objects', () => {
  // These samples target visible map art; broad walkable rectangles must not let the player enter it.
  for (const obstruction of [
    { x: 520, y: 315 }, // Tax Office front steps and planters
    { x: 600, y: 475 }, // Plaza bench and planting
    { x: 450, y: 560 }, // Corner Cup patio table and umbrella
    { x: 1090, y: 560 }, // Restaurant patio furniture
    { x: 1370, y: 570 }, // Supermarket cart and display
    { x: 470, y: 350 }, // North-west lamp post
    { x: 475, y: 610 }, // West shop-front lamp post
    { x: 100, y: 905 }, // Riverwalk tree and flower bed
    { x: 355, y: 870 }, // Southern garden tree
    { x: 1180, y: 865 }, // Stationery shop garden
  ]) {
    assert.equal(navigation.canWalkStreet(navigation.scaleStreetPoint(obstruction)), false,
      `visible object at ${obstruction.x},${obstruction.y} should block walking`);
  }
});

test('river walls and water are blocked while the street above the gardens remains reachable', () => {
  for (const x of [100, 300, 500, 650, 920, 1100, 1300, 1426]) {
    for (const y of [940, 960, 980]) {
      assert.equal(navigation.canWalkStreet(navigation.scaleStreetPoint({ x, y })), false,
        `river wall or water must not be treated as pavement at ${x},${y}`);
    }
  }
  const start = navigation.streetSpawnPoint('station');
  for (const x of [100, 320, 920, 1140]) {
    const target = navigation.scaleStreetPoint({ x, y: 880 });
    assert.ok(navigation.findPath(start, target, navigation.canWalkStreet, navigation.moveOnStreet).length > 0);
  }
  assert.equal(navigation.canWalkStreet(navigation.scaleStreetPoint({ x: 800, y: 480 })), false,
    'the fountain flower pots are not pavement');
});

test('Town Street does not allow walking across the landscaped ground between roads', () => {
  for (const offRoad of [{ x: 400, y: 700 }, { x: 1000, y: 740 }, { x: 500, y: 915 }]) {
    assert.equal(navigation.canWalkStreet(navigation.scaleStreetPoint(offRoad)), false,
      `unpaved landscaping at ${offRoad.x},${offRoad.y} should not be walkable`);
  }
});

test('the full central promenade beside Hospital supports walking and click paths', () => {
  for (const y of [660, 710, 760, 810, 840]) {
    const left = navigation.scaleStreetPoint({ x: 716, y });
    const right = navigation.scaleStreetPoint({ x: 820, y });
    for (const x of [716, 740, 768, 790, 820]) {
      assert.equal(navigation.canWalkStreet(navigation.scaleStreetPoint({ x, y })), true,
        `paved central road is blocked at ${x},${y}`);
    }
    assert.deepEqual(navigation.moveOnStreet(right, { x: left.x - right.x, y: 0 }), left);
    assert.deepEqual(navigation.moveOnStreet(left, { x: right.x - left.x, y: 0 }), right);
    assert.ok(navigation.findPath(right, left, navigation.canWalkStreet, navigation.moveOnStreet).length > 0);
  }
  assert.equal(navigation.canWalkStreet(navigation.scaleStreetPoint({ x: 640, y: 760 })), false,
    'the hospital itself remains blocked');
});

test('the station and Corner Cup entrances are connected by walkable street paths', () => {
  const start = navigation.scaleStreetPoint({ x: 768, y: 210 });
  for (const destination of [
    { x: 680, y: 420 }, // path between Corner Cup and the fountain
    { x: 350, y: 620 }, // west side of the middle cross street
    { x: 1145, y: 620 }, // east side, below the lower-east building
    { x: 505, y: 600 }, // Corner Cup entrance
    { x: 768, y: 944 }, // river walk / street exit
    { x: 1400, y: 620 }, // east side of the middle cross street
    { x: 142, y: 600 }, // narrow west end of the shop-front road
    { x: 230, y: 855 }, // road in front of the bank
    { x: 1050, y: 855 }, // road in front of the stationery shop
  ]) {
    const route = navigation.findPath(start, navigation.scaleStreetPoint(destination), navigation.canWalkStreet, navigation.moveOnStreet);
    assert.ok(route.length > 0, `a continuous road route should reach ${destination.x},${destination.y}`);
    assert.ok(route.every(navigation.canWalkStreet), 'every route point should stay on the roads');
  }
});

test('street movement cannot cross from a walkable road into a building', () => {
  const start = navigation.scaleStreetPoint({ x: 1080, y: 620 });
  const result = navigation.moveOnStreet(start, navigation.scaleStreetPoint({ x: 0, y: -120 }));
  assert.equal(navigation.canWalkStreet(result), true);
  assert.ok(result.y > navigation.scaleStreetPoint({ x: 1080, y: 575 }).y, 'movement stops at the restaurant frontage');
});

test('street movement stops at the southern buildings', () => {
  const start = navigation.scaleStreetPoint({ x: 1080, y: 620 });
  assert.equal(navigation.canWalkStreet(start), true, 'the approach is on the road');
  const result = navigation.moveOnStreet(navigation.scaleStreetPoint({ x: 1080, y: 855 }), navigation.scaleStreetPoint({ x: 0, y: -120 }));
  assert.equal(navigation.canWalkStreet(result), true);
  assert.ok(result.y > navigation.scaleStreetPoint({ x: 1080, y: 835 }).y, 'movement stops before entering the stationery shop');
  assert.equal(navigation.canWalkStreet(navigation.scaleStreetPoint({ x: 1080, y: 750 })), false, 'the player position inside the shop is blocked');
});

test('street movement does not clamp a blocked position through a wall', () => {
  const start = navigation.scaleStreetPoint({ x: 1400, y: 620 });
  const blocked = navigation.moveOnStreet(start, navigation.scaleStreetPoint({ x: 0, y: 260 }));
  assert.equal(navigation.canWalkStreet(blocked), true, 'the resulting player position stays walkable');
  assert.ok(blocked.y <= navigation.scaleStreetPoint({ x: 1400, y: 660 }).y, 'movement stays within the cross street instead of entering the southern buildings');
});

test('each station portal is on a walkable part of the station map', () => {
  assert.deepEqual(STATION_PORTALS.map(({ id }) => id), ['cafe', 'clothes', 'street']);
  for (const portal of STATION_PORTALS) assert.equal(canWalk(portal), true, `${portal.label} portal should be reachable`);
});

test('a portal activates only when the player steps into its ring', () => {
  const cafe = STATION_PORTALS[0];
  assert.ok(cafe);
  assert.equal(portalAt({ x: cafe.x + 38, y: cafe.y }, [cafe])?.id, 'cafe');
  assert.equal(portalAt({ x: cafe.x + 39, y: cafe.y }, [cafe]), null);
});

test('map-only destination artwork is present and uses the station map dimensions', () => {
  const assets = [
    'location_cafe_interior.png',
    'location_clothes_interior.png',
    'location_maplewood_street_expanded.png',
  ];
  for (const asset of assets) {
    const path = join(import.meta.dirname, '..', 'assets', 'locations', asset);
    assert.ok(statSync(path).size > 100_000, `${asset} should contain the generated map artwork`);
    const png = readFileSync(path);
    assert.equal(png.toString('ascii', 1, 4), 'PNG');
    assert.equal(png.readUInt32BE(16), 1536, `${asset} width`);
    assert.equal(png.readUInt32BE(20), 1024, `${asset} height`);
  }
});
import * as transitions from '../src/gameplay/station-navigation.ts';

// A cached ticket must not move the player before the server commits ticket use.
test('street transition waits for authorization and fails closed on network errors', async () => {
  assert.equal(typeof transitions.authorizeStreetExit, 'function', 'server-confirmed exit is missing');
  let resolve;
  const authorization = new Promise((done) => { resolve = done; });
  let entered = false;
  const attempt = transitions.authorizeStreetExit(() => authorization, () => { entered = true; });
  assert.equal(entered, false);
  resolve(true);
  await attempt;
  assert.equal(entered, true);
  entered = false;
  await transitions.authorizeStreetExit(async () => false, () => { entered = true; });
  assert.equal(entered, false);
  await transitions.authorizeStreetExit(async () => { throw new Error('offline'); }, () => { entered = true; });
  assert.equal(entered, false);
});
