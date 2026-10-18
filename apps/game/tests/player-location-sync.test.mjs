import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPlayerLocationSync,
  readPendingPlayerLocation,
} from '../src/features/location/player-location-sync.ts';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
}

const station = { mapId: 'loc_station', placeId: 'loc_station', x: 768, y: 370 };

// A movement burst must update local recovery without sending one request per position.
test('movement saves locally and debounces one server checkpoint', async () => {
  const storage = memoryStorage();
  let scheduled;
  const saves = [];
  const sync = createPlayerLocationSync({
    userId: 'user-1', initialLocation: station, storage,
    save: async location => { saves.push(location); },
    schedule: callback => { scheduled = callback; return 1; }, cancel: () => {},
  });
  sync.update({ ...station, x: 770 });
  sync.update({ ...station, x: 780 });
  sync.update({ ...station, x: 790 });
  assert.deepEqual(readPendingPlayerLocation('user-1', storage), { ...station, x: 790 });
  assert.equal(saves.length, 0);
  await scheduled();
  assert.deepEqual(saves, [{ ...station, x: 790 }]);
  assert.equal(readPendingPlayerLocation('user-1', storage), null);
});

// A map/place transition is important state and must not wait for the debounce window.
test('place changes flush immediately and account keys stay isolated', async () => {
  const storage = memoryStorage();
  const saves = [];
  const sync = createPlayerLocationSync({ userId: 'user-1', initialLocation: station, storage,
    save: async location => { saves.push(location); } });
  const cafe = { mapId: 'loc_station', placeId: 'loc_cafe', x: 768, y: 860 };
  sync.update(cafe);
  await sync.flush();
  assert.deepEqual(saves.at(-1), cafe);
  assert.equal(readPendingPlayerLocation('user-2', storage), null);
});
