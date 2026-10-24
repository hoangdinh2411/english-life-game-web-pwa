import test from 'node:test';
import assert from 'node:assert/strict';
import * as life from '../dist/index.js';

test('life rules restore approved energy and enforce exact opening boundaries', () => {
  assert.equal(typeof life.restoredEnergy, 'function');
  assert.equal(life.restoredEnergy(0, ['drink']), 20);
  assert.equal(life.restoredEnergy(0, ['food']), 50);
  assert.equal(life.restoredEnergy(0, ['drink', 'food']), 80);
  assert.equal(life.restoredEnergy(90, ['drink']), 100);
  assert.equal(life.isVenueOpen('store', new Date('2000-01-01T07:59:00Z')), false);
  assert.equal(life.isVenueOpen('store', new Date('2000-01-01T08:00:00Z')), true);
  assert.equal(life.isVenueOpen('store', new Date('2000-01-01T13:59:00Z')), true);
  assert.equal(life.isVenueOpen('store', new Date('2000-01-01T14:00:00Z')), false);
  assert.equal(life.venueHoursLabel('store'), '08:00–14:00');
  for (const [kind, opens, closes] of [
    ['organization', 8, 16],
    ['store', 8, 14],
    ['workplace', 7, 17],
  ]) {
    const timeAt = (hour, minute = 0) => new Date(Date.UTC(2000, 0, 1, hour, minute));
    assert.equal(life.isVenueOpen(kind, timeAt(opens - 1, 59)), false, `${kind} before opening`);
    assert.equal(life.isVenueOpen(kind, timeAt(opens)), true, `${kind} at opening`);
    assert.equal(life.isVenueOpen(kind, timeAt(closes - 1, 59)), true, `${kind} before closing`);
    assert.equal(life.isVenueOpen(kind, timeAt(closes)), false, `${kind} at closing`);
    assert.equal(life.venueHoursLabel(kind), `${String(opens).padStart(2, '0')}:00–${String(closes).padStart(2, '0')}:00`);
  }
});

test('quick rest is available only through 29 energy and adds exactly 50', () => {
  assert.equal(life.canSleep(29), true);
  assert.equal(life.canSleep(30), false);
  assert.equal(life.quickRestEnergy(0), 50);
  assert.equal(life.quickRestEnergy(29), 79);
});
