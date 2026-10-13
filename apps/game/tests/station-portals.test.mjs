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
