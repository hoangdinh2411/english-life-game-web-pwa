import assert from 'node:assert/strict';
import test from 'node:test';
import type { PoolClient } from 'pg';
import { WorldClockService, zonedGameTime, type ServerClock } from '../modules/world-clock/world-clock.service';

const fixedNow = new Date('2026-03-29T01:30:00.000Z');
const serverClock: ServerClock = { now: () => fixedNow };

function serviceFor(rows: Array<{ clock_start_utc: Date; clock_rate: number; time_zone: string }>): WorldClockService {
  const database = { query: async () => ({ rows }) };
  return new WorldClockService(database as never, serverClock);
}

test('ONB-01.3 calculates a shared world clock and does not persist calculated time', async () => {
  const row = { clock_start_utc: new Date('2026-03-29T00:30:00.000Z'), clock_rate: 6, time_zone: 'Europe/Stockholm' };
  const clock = serviceFor([row]);
  const first = await clock.read('player-one');
  const second = await clock.read('player-two');
  assert.deepEqual(first.public, second.public);
  assert.deepEqual(first.public, {
    gameTimeUtc: '2026-03-29T06:30:00.000Z',
    timeZone: 'Europe/Stockholm',
    clockRate: 6,
  });
});

test('ONB-01.3 reads the same existing world clock for a later joiner', async () => {
  const row = { clock_start_utc: new Date('2026-01-01T00:00:00.000Z'), clock_rate: 6, time_zone: 'Europe/Stockholm' };
  const client = { query: async () => ({ rows: [row] }) } as unknown as PoolClient;
  const clock = serviceFor([]);
  assert.equal((await clock.read('later-player', client)).public.gameTimeUtc, '2027-06-07T09:00:00.000Z');
});

test('ONB-01.3 converts one instant through country zones and DST boundaries', () => {
  assert.equal(zonedGameTime(new Date('2026-06-01T12:00:00Z'), 'Europe/Stockholm').minutes, 14 * 60);
  assert.equal(zonedGameTime(new Date('2026-06-01T12:00:00Z'), 'America/New_York').minutes, 8 * 60);
  assert.equal(zonedGameTime(new Date('2026-03-29T00:30:00Z'), 'Europe/Stockholm').minutes, 90);
  assert.equal(zonedGameTime(new Date('2026-03-29T01:30:00Z'), 'Europe/Stockholm').minutes, 210);
  assert.equal(zonedGameTime(new Date('2026-10-25T00:30:00Z'), 'Europe/Stockholm').minutes, 150);
  assert.equal(zonedGameTime(new Date('2026-10-25T01:30:00Z'), 'Europe/Stockholm').minutes, 150);
});
