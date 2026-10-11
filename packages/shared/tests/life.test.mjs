import test from 'node:test';
import assert from 'node:assert/strict';
import * as life from '../dist/index.js';

test('life rules restore approved energy and enforce exact opening boundaries', () => {
  assert.equal(typeof life.restoredEnergy, 'function');
  assert.equal(life.restoredEnergy(0, ['drink']), 20);
  assert.equal(life.restoredEnergy(0, ['food']), 50);
  assert.equal(life.restoredEnergy(0, ['drink', 'food']), 80);
  assert.equal(life.restoredEnergy(90, ['drink']), 100);
  assert.equal(life.isVenueOpen('store', new Date('2000-01-01T07:59:59Z')), false);
  assert.equal(life.isVenueOpen('store', new Date('2000-01-01T08:00:00Z')), true);
  assert.equal(life.isVenueOpen('store', new Date('2000-01-01T20:00:00Z')), false);
  assert.equal(life.isVenueOpen('organization', new Date('2000-01-01T16:00:00Z')), false);
  assert.equal(life.isVenueOpen('workplace', new Date('2000-01-01T07:00:00Z')), true);
});
