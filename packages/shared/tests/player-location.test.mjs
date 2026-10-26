import assert from 'node:assert/strict';
import test from 'node:test';
import { playerLocationSchema } from '../dist/index.js';

// A forged map/place pair could restore the player into an interior on the wrong map.
test('player location accepts only authored map and place combinations', () => {
  assert.deepEqual(playerLocationSchema.parse({ mapId: 'loc_station', placeId: 'loc_cafe', x: 700, y: 800 }), {
    mapId: 'loc_station', placeId: 'loc_cafe', x: 700, y: 800,
  });
  assert.deepEqual(playerLocationSchema.parse({ mapId: 'loc_town_street', placeId: 'loc_corner_cafe', x: 800, y: 700 }), {
    mapId: 'loc_town_street', placeId: 'loc_corner_cafe', x: 800, y: 700,
  });
  assert.deepEqual(playerLocationSchema.parse({ mapId: 'loc_town_street', placeId: 'loc_tax_office', x: 768, y: 860 }), {
    mapId: 'loc_town_street', placeId: 'loc_tax_office', x: 768, y: 860,
  });
  assert.throws(() => playerLocationSchema.parse({ mapId: 'loc_station', placeId: 'loc_corner_cafe', x: 1, y: 1 }));
  assert.throws(() => playerLocationSchema.parse({ mapId: 'loc_town_street', placeId: 'loc_clothes', x: 1, y: 1 }));
  assert.throws(() => playerLocationSchema.parse({ mapId: 'loc_station', placeId: 'loc_cafe', x: 700, y: 800, coins: 999 }));
  assert.throws(() => playerLocationSchema.parse({ mapId: 'loc_station', placeId: 'loc_cafe', x: 1537, y: 800 }));
  assert.throws(() => playerLocationSchema.parse({ mapId: 'loc_town_street', placeId: 'loc_town_street', x: 2305, y: 800 }));
});
