import assert from 'node:assert/strict';
import test from 'node:test';
import * as preferences from '../src/features/hud/preferences.ts';

test('audio preferences persist across reload and notify mounted consumers', () => {
  assert.equal(typeof preferences.createPreferences, 'function');
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const first = preferences.createPreferences(storage);
  assert.deepEqual(first.getSnapshot(), { sound: true, speechRate: 1, speechPitch: 1 });
  let notifications = 0;
  const unsubscribe = first.subscribe(() => notifications++);
  first.set('sound', false);
  first.set('speechRate', 1.25);
  first.set('speechPitch', 0.85);
  assert.deepEqual(preferences.createPreferences(storage).getSnapshot(), { sound: false, speechRate: 1.25, speechPitch: 0.85 });
  unsubscribe();
  first.set('sound', true);
  assert.equal(notifications, 3);
});

test('invalid or unavailable device storage keeps usable defaults and in-memory switches', () => {
  assert.equal(typeof preferences.createPreferences, 'function');
  for (const raw of ['oops', 'null', '{"sound":"false","obsolete":1}']) {
    const store = preferences.createPreferences({ getItem: () => raw, setItem() { throw Error('blocked'); } });
    assert.deepEqual(store.getSnapshot(), { sound: true, speechRate: 1, speechPitch: 1 });
    store.set('sound', false);
    assert.equal(store.getSnapshot().sound, false);
  }
});

test('speech playback preferences are bounded and invalid saved values use defaults', () => {
  const values = new Map([['life-abroad.preferences', JSON.stringify({
    sound: true, obsolete: false, speechRate: 99, speechPitch: 'low',
  })]]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const store = preferences.createPreferences(storage);
  assert.deepEqual(store.getSnapshot(), { sound: true, speechRate: 1.5, speechPitch: 1 });
  store.set('speechRate', 0.1);
  store.set('speechPitch', 5);
  assert.deepEqual(store.getSnapshot(), { sound: true, speechRate: 0.75, speechPitch: 1.25 });
});
