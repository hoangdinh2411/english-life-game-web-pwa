import assert from 'node:assert/strict';
import test from 'node:test';
import { createMapCollision } from '../src/features/location/map-collision.ts';

const collisionData = {
  version: 1,
  width: 100,
  height: 100,
  walkable: [{ kind: 'polygon', points: [[0, 0], [100, 0], [100, 100], [0, 100]] }],
  obstacles: [
    { kind: 'polygon', points: [[20, 20], [40, 20], [40, 40], [20, 40]] },
    { kind: 'circle', x: 70, y: 70, radius: 5 },
  ],
};

test('map collision combines walkable polygons with polygon and circle obstacles', () => {
  const collision = createMapCollision(collisionData, { label: 'Test map', circleClearance: 3 });

  assert.equal(collision.canWalk({ x: 10, y: 10 }), true);
  assert.equal(collision.canWalk({ x: 30, y: 30 }), false);
  assert.equal(collision.canWalk({ x: 78, y: 70 }), false, 'circle clearance should protect the player footprint');
  assert.equal(collision.canWalk({ x: 79, y: 70 }), true);
  assert.equal(collision.canWalk({ x: 101, y: 50 }), false);
});

test('map collision rejects unsupported or incomplete geometry', () => {
  assert.throws(
    () => createMapCollision({ ...collisionData, version: 2 }, { label: 'Test map' }),
    /collision map is incomplete/,
  );
  assert.throws(
    () => createMapCollision({ ...collisionData, walkable: [] }, { label: 'Test map' }),
    /collision map is incomplete/,
  );
  assert.throws(
    () => createMapCollision({ ...collisionData, obstacles: [{ kind: 'circle', x: 1, y: 1, radius: 0 }] }, { label: 'Test map' }),
    /unsupported shape/,
  );
});
