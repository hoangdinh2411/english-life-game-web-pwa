import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import type { LifeState } from '@life-abroad/shared';
import { LifeService } from '../modules/life/life.service';
import { LifeRepository } from '../modules/life/life.repository';
import { DatabaseService } from '../infrastructure/database/database.service';
import { EconomyService } from '../modules/economy/economy.service';
import { ShopsService } from '../modules/shops/shops.service';
import type { WorldClockReading } from '../modules/world-clock/world-clock.service';

test('quick rest enforces 0–29, leaves world time unchanged and safely replays', async () => {
  const url = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(url.hostname, '127.0.0.1'); assert.ok(['54322', '55422'].includes(url.port));
  const pool = new Pool({ connectionString: url.toString() });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = await client.query<{ id: string }>('SELECT id FROM auth.users WHERE email=$1', ['test@gmail.com']);
    assert.ok(user.rows[0], 'Use the existing test account; never create a new user');
    const id = user.rows[0].id;
    const database = { transaction: (operation: (connection: PoolClient) => Promise<LifeState>) => operation(client) };
    const repository = new LifeRepository();
    const fixed = new Date('2026-06-01T10:00:00.000Z');
    const reading: WorldClockReading = { gameTimeUtc: fixed, serverTimeUtc: fixed, timeZone: 'Europe/Stockholm',
      clockRate: 6, public: { gameTimeUtc: fixed.toISOString(), timeZone: 'Europe/Stockholm', clockRate: 6 } };
    const worldClock = { read: async () => reading };
    const service = new LifeService(database as DatabaseService, repository, {} as EconomyService, {} as ShopsService,
      worldClock as never);
    await repository.lock(client, id);
    for (const energy of [30, 100]) {
      await client.query('UPDATE player_stats SET energy=$2 WHERE user_id=$1', [id, energy]);
      const before = await repository.state(client, id, reading);
      await assert.rejects(service.sleep(id, randomUUID()), /not tired yet/);
      const after = await repository.state(client, id, reading);
      assert.equal(after.energy, energy);
      assert.ok(Date.parse(after.gameTime) - Date.parse(before.gameTime) < 1000);
    }
    for (const energy of [29, 0]) {
      await client.query('UPDATE player_stats SET energy=$2 WHERE user_id=$1', [id, energy]);
      const before = await repository.state(client, id, reading);
      const key = randomUUID();
      const rested = await service.sleep(id, key);
      assert.equal(rested.energy, energy + 50);
      assert.equal(rested.gameTime, before.gameTime);
      assert.deepEqual(await service.sleep(id, key), rested);
    }
  } finally {
    await client.query('ROLLBACK'); client.release(); await pool.end();
  }
});
