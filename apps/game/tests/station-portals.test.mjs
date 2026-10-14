import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import * as navigation from '../src/gameplay/station-navigation.ts';
const { canWalk, portalAt, STATION_PORTALS } = navigation;

test('Town Street uses expanded world dimensions and clamps movement to its larger playable map', () => {
  assert.deepEqual(navigation.STREET_MAP_SIZE, { width: 2304, height: 1536 });
  assert.deepEqual(navigation.clampStreetPosition({ x: 2400, y: 20 }), { x: 2232, y: 165 });
  assert.deepEqual(navigation.clampStreetPosition({ x: -20, y: 1550 }), { x: 72, y: 1477.5 });
});

test('street transition spawn positions are on valid walkable roads', () => {
  for (const fromStreetPortal of [false, true]) {
    const spawn = navigation.streetSpawnPoint(fromStreetPortal);
    assert.equal(navigation.canWalkStreet(spawn), true, `street spawn from portal=${fromStreetPortal} must be walkable`);
    const route = navigation.findPath(spawn, navigation.scaleStreetPoint({ x: 768, y: 944 }), navigation.canWalkStreet, navigation.moveOnStreet);
    assert.ok(route.length > 0, `street spawn from portal=${fromStreetPortal} can reach the river road`);
  }
});

test('Town Street allows its street entrances but blocks buildings, trees, water and the fountain', () => {
  assert.equal(navigation.canWalkStreet(navigation.scaleStreetPoint({ x: 768, y: 210 })), true, 'station entrance path');
  assert.equal(navigation.canWalkStreet(navigation.scaleStreetPoint({ x: 1260, y: 548 })), true, 'Corner Cup entrance path');
  assert.equal(navigation.canWalkStreet(navigation.scaleStreetPoint({ x: 350, y: 620 })), true, 'middle cross street stays open past the left houses');
  assert.equal(navigation.canWalkStreet(navigation.scaleStreetPoint({ x: 1145, y: 620 })), true, 'middle cross street stays open below Corner Cup');
  assert.equal(navigation.canWalkStreet(navigation.scaleStreetPoint({ x: 350, y: 620 })), true, 'middle cross street remains walkable across the west side');
  assert.equal(navigation.canWalkStreet(navigation.scaleStreetPoint({ x: 1400, y: 620 })), true, 'middle cross street remains walkable across the east side');
  assert.equal(navigation.canWalkStreet(navigation.scaleStreetPoint({ x: 1145, y: 533 })), false, 'Corner Cup frontage where the screenshot shows the player standing');
  for (const obstruction of [
    { x: 768, y: 420 }, // central fountain
    { x: 350, y: 533 }, // middle-left house
    { x: 100, y: 180 }, // northwest homes/shop
    { x: 400, y: 300 }, // northwest market
    { x: 1080, y: 300 }, // northeast shop
    { x: 1400, y: 500 }, // post office building
    { x: 1400, y: 780 }, // southeast homes
    { x: 600, y: 780 }, // south-centre shop
    { x: 500, y: 990 }, // waterfront
  ]) {
    assert.equal(navigation.canWalkStreet(navigation.scaleStreetPoint(obstruction)), false, `blocked at ${obstruction.x},${obstruction.y}`);
  }
});

test('the station and Corner Cup entrances are connected by walkable street paths', () => {
  const start = navigation.scaleStreetPoint({ x: 768, y: 210 });
  for (const destination of [
    { x: 600, y: 420 }, // paved loop around the fountain
    { x: 350, y: 620 }, // west side of the middle cross street
    { x: 1145, y: 620 }, // east side, below Corner Cup
    { x: 1260, y: 548 }, // café entrance
    { x: 768, y: 944 }, // river walk / street exit
    { x: 1400, y: 620 }, // east side of the cross street
  ]) {
    const route = navigation.findPath(start, navigation.scaleStreetPoint(destination), navigation.canWalkStreet, navigation.moveOnStreet);
    assert.ok(route.length > 0, `a continuous road route should reach ${destination.x},${destination.y}`);
    assert.ok(route.every(navigation.canWalkStreet), 'every route point should stay on the roads');
  }
});

test('street movement cannot cross from a walkable road into a building', () => {
  const start = navigation.scaleStreetPoint({ x: 1400, y: 620 });
  const result = navigation.moveOnStreet(start, navigation.scaleStreetPoint({ x: 0, y: -120 }));
  assert.equal(navigation.canWalkStreet(result), true);
  assert.ok(result.y > navigation.scaleStreetPoint({ x: 1400, y: 590 }).y, 'movement stops at the post office frontage');
});

test('street movement stops at the Corner Cup frontage despite the adjoining road strip', () => {
  const start = navigation.scaleStreetPoint({ x: 1145, y: 620 });
  assert.equal(navigation.canWalkStreet(start), true, 'the approach is on the road');
  const result = navigation.moveOnStreet(start, navigation.scaleStreetPoint({ x: 0, y: -120 }));
  assert.equal(navigation.canWalkStreet(result), true);
  assert.ok(result.y > navigation.scaleStreetPoint({ x: 1145, y: 595 }).y, 'movement stops before entering the café footprint');
  assert.equal(navigation.canWalkStreet(navigation.scaleStreetPoint({ x: 1145, y: 533 })), false, 'the player position in the screenshot is blocked');
});

test('street movement does not clamp a blocked position through a wall', () => {
  const start = navigation.scaleStreetPoint({ x: 1400, y: 620 });
  const blocked = navigation.moveOnStreet(start, navigation.scaleStreetPoint({ x: 0, y: 260 }));
  assert.equal(navigation.canWalkStreet(blocked), true, 'the resulting player position stays walkable');
  assert.ok(blocked.y < navigation.scaleStreetPoint({ x: 1400, y: 690 }).y, 'movement stops before south-east homes instead of clamping beyond the wall');
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
    'location_maplewood_street.png',
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
