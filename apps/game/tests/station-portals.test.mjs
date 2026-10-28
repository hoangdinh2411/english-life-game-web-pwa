import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as navigation from '../src/gameplay/station-navigation.ts';

const { canWalk, portalAt, STATION_PORTALS, STREET_PORTALS } = navigation;
const street = point => navigation.scaleStreetPoint(point);

test('street authorization reports success and failure to the transition UI', async () => {
  let entered = false;
  assert.equal(await navigation.authorizeStreetExit(async () => true, () => { entered = true; }), true);
  assert.equal(entered, true);

  entered = false;
  assert.equal(await navigation.authorizeStreetExit(async () => false, () => { entered = true; }), false);
  assert.equal(entered, false);
  assert.equal(await navigation.authorizeStreetExit(async () => { throw new Error('offline'); }, () => {}), false);
});

test('denied station shop entry returns to a walkable point', () => {
  for (const portal of STATION_PORTALS.filter(portal => portal.id !== 'street')) {
    const start = navigation.stationStoreReturnPoint(portal);
    assert.equal(canWalk(start), true);
    assert.equal(portalAt(start, STATION_PORTALS), null);
  }
});

test('Town Street keeps its authored world size', () => {
  assert.deepEqual(navigation.STREET_MAP_SIZE, { width: 2304, height: 1536 });
  assert.deepEqual(navigation.clampStreetPosition({ x: 2400, y: 20 }), { x: 2232, y: 165 });
});

test('venue portals align with the rebuilt storefronts and return to open road', () => {
  assert.deepEqual(navigation.TAX_OFFICE_PORTAL, {
    id: 'tax_office', label: 'Tax Office', ...street({ x: 500, y: 365 }),
  });
  assert.deepEqual(navigation.CORNER_CUP_PORTAL, {
    id: 'corner_cafe', label: 'Corner Cup Café', ...street({ x: 150, y: 610 }),
  });
  assert.deepEqual(STREET_PORTALS.map(({ id }) => id), ['tax_office', 'corner_cafe', 'station']);

  for (const arrival of ['station', 'corner_cafe', 'tax_office']) {
    const spawn = navigation.streetSpawnPoint(arrival);
    assert.equal(navigation.canWalkStreet(spawn), true, `${arrival} return is walkable`);
    assert.equal(portalAt(spawn, STREET_PORTALS), null, `${arrival} return does not bounce back`);
  }
});

test('all streets are wide connected main roads without alley-sized corridors', () => {
  const roadBands = [
    { y: 145, xs: [30, 300, 600, 930, 1250, 1500] },
    { y: 400, xs: [30, 300, 550, 980, 1250, 1500] },
    { y: 650, xs: [30, 300, 550, 980, 1250, 1500] },
    { y: 880, xs: [30, 300, 550, 980, 1250, 1500] },
  ];
  for (const { y, xs } of roadBands) {
    for (const x of xs) {
      assert.equal(navigation.canWalkStreet(street({ x, y })), true, `main road is open at ${x},${y}`);
      assert.equal(navigation.canWalkStreet(street({ x, y: y - 20 })), true, `upper lane is open at ${x},${y - 20}`);
      assert.equal(navigation.canWalkStreet(street({ x, y: y + 20 })), true, `lower lane is open at ${x},${y + 20}`);
    }
  }

  for (const y of [115, 155, 270, 320, 700, 780, 920, 980]) {
    for (const x of [670, 720, 768, 820, 870]) {
      assert.equal(navigation.canWalkStreet(street({ x, y })), true, `boulevard is open at ${x},${y}`);
    }
  }
  for (const y of [440, 500, 580]) {
    for (const x of [665, 875]) {
      assert.equal(navigation.canWalkStreet(street({ x, y })), true,
        `boulevard detour around the fountain is open at ${x},${y}`);
    }
  }
});

test('buildings, river edges and the central fountain stay outside movement bounds', () => {
  for (const blocked of [
    { x: 180, y: 280 }, { x: 500, y: 280 }, { x: 1060, y: 280 }, { x: 1370, y: 280 },
    { x: 180, y: 500 }, { x: 500, y: 500 }, { x: 1060, y: 500 }, { x: 1370, y: 500 },
    { x: 180, y: 760 }, { x: 500, y: 760 }, { x: 1060, y: 760 }, { x: 1370, y: 760 },
    { x: 768, y: 500 }, { x: 300, y: 950 }, { x: 1250, y: 950 },
  ]) {
    assert.equal(navigation.canWalkStreet(street(blocked)), false, `blocked at ${blocked.x},${blocked.y}`);
  }
});

test('street furniture has clearance while every road retains a simple detour', () => {
  for (const fixture of [
    { x: 360, y: 365 }, { x: 615, y: 365 }, { x: 920, y: 365 },
    { x: 1210, y: 365 }, { x: 360, y: 610 }, { x: 920, y: 610 },
    { x: 610, y: 855 }, { x: 930, y: 855 },
  ]) {
    assert.equal(navigation.canWalkStreet(street(fixture)), false, `fixture blocks at ${fixture.x},${fixture.y}`);
    assert.equal(navigation.canWalkStreet(street({ x: fixture.x, y: fixture.y + 30 })), true,
      `wide road passes the fixture at ${fixture.x},${fixture.y}`);
  }
});

test('every district road and portal is reachable from the station', () => {
  const start = navigation.streetSpawnPoint('station');
  const destinations = [
    navigation.TAX_OFFICE_PORTAL,
    navigation.CORNER_CUP_PORTAL,
    street({ x: 80, y: 145 }), street({ x: 1460, y: 145 }),
    street({ x: 80, y: 400 }), street({ x: 1460, y: 400 }),
    street({ x: 80, y: 650 }), street({ x: 1460, y: 650 }),
    street({ x: 80, y: 880 }), street({ x: 1460, y: 880 }),
    street({ x: 768, y: 980 }),
  ];
  for (const destination of destinations) {
    const route = navigation.findPath(start, destination, navigation.canWalkStreet, navigation.moveOnStreet);
    assert.ok(route.length > 0, `route reaches ${destination.x},${destination.y}`);
    assert.ok(route.every(navigation.canWalkStreet));
  }
});

test('the rebuilt background remains a 1536×1024 PNG', () => {
  const image = readFileSync(new URL('../assets/locations/location_maplewood_street_expanded.png', import.meta.url));
  assert.equal(image.subarray(1, 4).toString(), 'PNG');
  assert.equal(image.readUInt32BE(16), 1536);
  assert.equal(image.readUInt32BE(20), 1024);
});
