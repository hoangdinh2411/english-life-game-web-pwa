import assert from 'node:assert/strict';
import test from 'node:test';
import * as preferences from '../src/features/hud/preferences.ts';

test('Sound and Coach preferences persist across reload and notify mounted consumers', () => {
  assert.equal(typeof preferences.createPreferences, 'function');
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const first = preferences.createPreferences(storage);
  assert.deepEqual(first.getSnapshot(), { sound: true, coach: false });
  let notifications = 0;
  const unsubscribe = first.subscribe(() => notifications++);
  first.set('sound', false);
  first.set('coach', true);
  assert.equal(notifications, 2);
  assert.deepEqual(preferences.createPreferences(storage).getSnapshot(), { sound: false, coach: true });
  unsubscribe();
  first.set('coach', false);
  assert.equal(notifications, 2);
});

test('invalid or unavailable device storage keeps usable defaults and in-memory switches', () => {
  assert.equal(typeof preferences.createPreferences, 'function');
  for (const raw of ['oops', 'null', '{"sound":"false","coach":1}']) {
    const store = preferences.createPreferences({ getItem: () => raw, setItem() { throw Error('blocked'); } });
    assert.deepEqual(store.getSnapshot(), { sound: true, coach: false });
    store.set('sound', false);
    assert.equal(store.getSnapshot().sound, false);
  }
});
