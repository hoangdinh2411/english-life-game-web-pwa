import assert from 'node:assert/strict';
import test from 'node:test';
import { mapLocationFromPlayerLocation, playerLocationFromMapLocation } from '../src/features/location/player-location.ts';

// Collapsing an interior to its parent map would resume in the wrong scene after reload.
test('saved locations preserve the exact place and its parent map', () => {
  assert.equal(mapLocationFromPlayerLocation({ mapId: 'loc_station', placeId: 'loc_cafe', x: 700, y: 800 }), 'cafe');
  assert.equal(mapLocationFromPlayerLocation({ mapId: 'loc_town_street', placeId: 'loc_corner_cafe', x: 800, y: 700 }), 'corner_cafe');
  assert.deepEqual(playerLocationFromMapLocation('clothes', { x: 720, y: 810 }), { mapId: 'loc_station', placeId: 'loc_clothes', x: 720, y: 810 });
  assert.deepEqual(playerLocationFromMapLocation('corner_cafe', { x: 800, y: 700 }), { mapId: 'loc_town_street', placeId: 'loc_corner_cafe', x: 800, y: 700 });
});
