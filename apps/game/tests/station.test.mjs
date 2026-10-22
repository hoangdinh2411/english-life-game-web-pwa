import assert from 'node:assert/strict';
import test from 'node:test';
import { canWalk, findPath, movePlayer, movementDelta, nearestNpc, STATION_NPCS } from '../src/gameplay/station-navigation.ts';

test('station keeps movement on the concourse and out of the kiosk and shops', () => {
  assert.equal(canWalk({ x: 768, y: 370 }), true);
  for (const point of [{ x: 768, y: 80 }, { x: 300, y: 500 }, { x: 768, y: 500 }, { x: 1250, y: 500 }, { x: 70, y: 900 }]) assert.equal(canWalk(point), false);
  const start = { x: 610, y: 510 };
  assert.deepEqual(movePlayer(start, { x: 180, y: 0 }), start);
  assert.ok(canWalk(movePlayer({ x: 768, y: 370 }, { x: 300, y: 0 })));
});

test('tap routes around the kiosk to the receptionist without crossing obstacles', () => {
  const route = findPath({ x: 768, y: 370 }, { x: 850, y: 670 });
  assert.ok(route.length > 0);
  assert.ok(route.every(canWalk));
  for (let index = 1; index < route.length; index++) {
    const start = route[index - 1], end = route[index];
    const reached = movePlayer(start, { x: end.x - start.x, y: end.y - start.y });
    assert.ok(Math.hypot(reached.x - end.x, reached.y - end.y) < 0.1);
  }
});

test('the receptionist and three passengers interact only within speaking distance', () => {
  assert.equal(STATION_NPCS.length, 4);
  assert.equal(nearestNpc({ x: 768, y: 370 }), null);
  assert.equal(nearestNpc({ x: 840, y: 615 })?.id, 'npc_station_information');
});
test('W A S D unit directions move at walking speed instead of stopping as near targets', () => {
  for (const direction of [{ x: 0, y: -1 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 0 }]) {
    const movement = movementDelta(direction, 8, true);
    assert.deepEqual(movement, { x: direction.x * 8, y: direction.y * 8 });
  }
  assert.equal(Math.hypot(...Object.values(movementDelta({ x: 1, y: 1 }, 8, true))), 8);
  assert.deepEqual(movementDelta({ x: 1, y: 0 }, 8, false), { x: 0, y: 0 });
});
