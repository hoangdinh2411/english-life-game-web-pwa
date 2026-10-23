import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', ssr: { external: ['@life-abroad/shared'] } });
try {
  const { createWorldClockSync, interpolateWorldTime, formatWorldTime } =
    await server.ssrLoadModule('/src/features/world-clock/world-clock.ts');

  test('ONB-01.4 interpolates from receipt performance time at the server rate', () => {
    const snapshot = { gameTimeUtc: '2026-10-22T10:00:00.000Z', timeZone: 'Europe/Stockholm', clockRate: 6 };
    assert.equal(interpolateWorldTime(snapshot, 1_000, 11_000).toISOString(), '2026-10-22T10:01:00.000Z');
    assert.equal(interpolateWorldTime(snapshot, 1_000, 500).toISOString(), snapshot.gameTimeUtc);
  });

  test('ONB-01.4 formats the same instant in the snapshot IANA zone', () => {
    const instant = new Date('2026-06-01T12:00:00.000Z');
    assert.match(formatWorldTime(instant, 'Europe/Stockholm', 'en-GB'), /14:00/);
    assert.match(formatWorldTime(instant, 'America/New_York', 'en-GB'), /08:00/);
  });

  test('ONB-01.4 synchronizes on load, reconnect, visible return and every minute, then cleans up', async () => {
    let now = 100;
    let online = false;
    let hidden = false;
    let timerCallback;
    let timerDelay = 0;
    let cleared = 0;
    const listeners = new Map();
    const snapshots = [];
    const sync = createWorldClockSync({
      load: async () => ({ gameTimeUtc: '2026-10-22T10:00:00.000Z', timeZone: 'Europe/Stockholm', clockRate: 6 }),
      performanceNow: () => now,
      isOnline: () => online,
      isHidden: () => hidden,
      setInterval: (callback, delay) => { timerCallback = callback; timerDelay = delay; return 7; },
      clearInterval: id => { assert.equal(id, 7); cleared++; },
      addEventListener: (name, callback) => listeners.set(name, callback),
      removeEventListener: (name, callback) => { if (listeners.get(name) === callback) listeners.delete(name); },
      publish: value => snapshots.push(value),
    });
    await sync.start();
    assert.equal(timerDelay, 60_000);
    assert.equal(snapshots.length, 0, 'offline load does not request private state');
    online = true; now = 200; await listeners.get('online')();
    hidden = true; now = 300; await listeners.get('visibilitychange')();
    hidden = false; now = 400; await listeners.get('visibilitychange')();
    now = 500; await timerCallback();
    assert.deepEqual(snapshots.map(value => value.receivedAt), [200, 400, 500]);
    sync.dispose();
    assert.equal(cleared, 1);
    assert.equal(listeners.size, 0);
  });
} finally {
  await server.close();
}
