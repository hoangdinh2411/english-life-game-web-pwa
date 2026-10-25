import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { ConflictException } from '@nestjs/common';
import { LifeService } from '../modules/life/life.service';
import { LifeRepository } from '../modules/life/life.repository';
import { DatabaseService } from '../infrastructure/database/database.service';
import { EconomyService } from '../modules/economy/economy.service';
import { ShopsService } from '../modules/shops/shops.service';
import type { WorldClockReading } from '../modules/world-clock/world-clock.service';

test('quick rest enforces 0–29, preserves world time, replays once and serializes different keys', async () => {
  const url = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '54322');
  const pool = new Pool({ connectionString: url.toString() });
  const database = new DatabaseService({ get: () => url.toString() } as never);
  const repository = new LifeRepository();
  const fixed = new Date('2026-06-01T10:00:00.000Z');
  const reading: WorldClockReading = { gameTimeUtc: fixed, serverTimeUtc: fixed, timeZone: 'Europe/Stockholm',
    clockRate: 6, public: { gameTimeUtc: fixed.toISOString(), timeZone: 'Europe/Stockholm', clockRate: 6 } };
  const service = new LifeService(database, repository, {} as EconomyService, {} as ShopsService,
    { read: async () => reading } as never);
  const user = await pool.query<{ id: string }>('SELECT id FROM auth.users WHERE email=$1', ['test@gmail.com']);
  assert.ok(user.rows[0], 'Use the existing test account; never create a new user');
  const userId = user.rows[0].id;
  const original = await pool.query<{ energy: number | null }>('SELECT energy FROM player_stats WHERE user_id=$1', [userId]);
  const keys = [randomUUID(), randomUUID(), randomUUID()];
  try {
    await pool.query('UPDATE player_stats SET energy=30 WHERE user_id=$1', [userId]);
    await assert.rejects(service.sleep(userId, keys[0]!), (error: unknown) =>
      error instanceof ConflictException && error.getStatus() === 409 && error.message === 'You are not tired yet.');
    assert.equal((await service.get(userId)).energy, 30);

    await pool.query('UPDATE player_stats SET energy=29 WHERE user_id=$1', [userId]);
    const rested = await service.sleep(userId, keys[0]!);
    assert.equal(rested.energy, 79);
    assert.equal(rested.gameTime, fixed.toISOString());
    assert.deepEqual(await service.sleep(userId, keys[0]!), rested);

    await pool.query('UPDATE player_stats SET energy=29 WHERE user_id=$1', [userId]);
    const concurrent = await Promise.allSettled([service.sleep(userId, keys[1]!), service.sleep(userId, keys[2]!)]);
    assert.equal(concurrent.filter(result => result.status === 'fulfilled').length, 1);
    const rejected = concurrent.find(result => result.status === 'rejected');
    assert.ok(rejected && rejected.status === 'rejected' && rejected.reason instanceof ConflictException);
    assert.equal(rejected.reason.message, 'You are not tired yet.');
    assert.equal((await service.get(userId)).energy, 79);
  } finally {
    await pool.query('DELETE FROM player_actions WHERE user_id=$1 AND key=ANY($2::uuid[])', [userId, keys]);
    await pool.query('UPDATE player_stats SET energy=$2 WHERE user_id=$1', [userId, original.rows[0]?.energy ?? 100]);
    await database.onApplicationShutdown();
    await pool.end();
  }
});
