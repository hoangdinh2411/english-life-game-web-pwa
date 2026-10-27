import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createPreferences } from '../src/features/hud/preferences.ts';
import { createSyncedPreferences } from '../src/features/hud/synced-preferences.ts';

const stored = (changes = {}) => ({
  speechRate: 1,
  speechPitch: 1,
  updatedAt: '2026-10-25T08:00:00.000Z',
  ...changes,
});

function setup(overrides = {}) {
  const calls = [];
  const local = createPreferences();
  const remote = {
    load: async () => ({ preferences: stored({ speechRate: 1.2 }) }),
    initialize: async value => { calls.push(['initialize', value]); return stored(value); },
    update: async value => { calls.push(['update', value]); return stored(value); },
    ...overrides,
  };
  return { calls, local, store: createSyncedPreferences(local, remote, { debounceMs: 10 }) };
}

test('authenticated loading uses the server winner without blocking local startup', async () => {
  let resolveLoad;
  const pending = new Promise(resolve => { resolveLoad = resolve; });
  const { store } = setup({ load: () => pending });
  const loading = store.start();
  assert.equal(store.getSnapshot().status, 'loading');
  assert.equal(store.getSnapshot().speechRate, 1);
  resolveLoad({ preferences: stored({ speechRate: 1.3 }) });
  await loading;
  assert.deepEqual(store.getSnapshot(), {
    sound: true, speechRate: 1.3, speechPitch: 1, status: 'saved',
  });
});

test('missing server preferences initialize once from bounded legacy local values', async () => {
  const storage = { getItem: () => JSON.stringify({ sound: false, speechRate: 1.4, speechPitch: 0.8 }), setItem() {} };
  const local = createPreferences(storage);
  const calls = [];
  const store = createSyncedPreferences(local, {
    load: async () => ({ preferences: null }),
    initialize: async value => { calls.push(value); return stored({ speechRate: 1.1, speechPitch: 0.9 }); },
    update: async value => stored(value),
  }, { debounceMs: 10 });
  await store.start();
  assert.deepEqual(calls, [{ speechRate: 1.4, speechPitch: 0.8 }]);
  assert.equal(store.getSnapshot().speechRate, 1.1);
  assert.equal(store.getSnapshot().sound, false);
});

test('local practice performs no preference API calls', async () => {
  const { calls, store } = setup();
  store.set('speechRate', 1.25);
  await delay(20);
  assert.equal(store.getSnapshot().status, 'local');
  assert.deepEqual(calls, []);
});

test('voice sliders debounce to the latest value', async () => {
  const { calls, store } = setup();
  await store.start();
  store.set('speechRate', 1.1);
  store.set('speechRate', 1.25);
  assert.equal(store.getSnapshot().speechRate, 1.25);
  await delay(20);
  assert.deepEqual(calls.filter(([operation]) => operation === 'update').at(-1), ['update', { speechRate: 1.25 }]);
});

test('older responses cannot overwrite a newer local value', async () => {
  const resolvers = [];
  const { store } = setup({ update: value => new Promise(resolve => resolvers.push(() => resolve(stored(value)))) });
  await store.start();
  store.set('speechRate', 1.1);
  await delay(20);
  store.set('speechPitch', 0.9);
  await delay(20);
  assert.equal(resolvers.length, 2);
  resolvers[1]();
  await Promise.resolve();
  resolvers[0]();
  await Promise.resolve();
  assert.equal(store.getSnapshot().speechRate, 1.1);
  assert.equal(store.getSnapshot().speechPitch, 0.9);
  assert.equal(store.getSnapshot().status, 'saved');
});

test('failed saves keep the desired value and Retry sends only the latest state', async () => {
  let fail = true;
  const calls = [];
  const { store } = setup({ update: async value => {
    calls.push(value);
    if (fail) throw new Error('offline');
    return stored(value);
  } });
  await store.start();
  store.set('speechRate', 1.25);
  await delay(20);
  assert.equal(store.getSnapshot().speechRate, 1.25);
  assert.equal(store.getSnapshot().status, 'error');
  fail = false;
  await store.retry();
  assert.deepEqual(calls.at(-1), { speechRate: 1.25, speechPitch: 1 });
  assert.equal(store.getSnapshot().status, 'saved');
});
