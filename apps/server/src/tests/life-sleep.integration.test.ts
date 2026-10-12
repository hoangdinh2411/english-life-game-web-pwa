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

test('sleep enforces below 50%, advances eight hours and safely replays at full energy', async () => {
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
    const service = new LifeService(database as DatabaseService, repository, {} as EconomyService, {} as ShopsService);
    await repository.lock(client, id);
    const anchor = new Date(Date.now() - 60_000);
    const base = new Date('2000-01-01T08:00:00.000Z');
    await client.query('UPDATE player_life SET clock_time=$2,clock_anchor=$3,clock_rate=2 WHERE user_id=$1', [id, base, anchor]);
    const faster = await repository.state(client, id, 6);
    assert.equal(faster.clockRate, 6);
    assert.ok(Math.abs(Date.parse(faster.gameTime) - (base.getTime() + 120_000)) < 1500,
      'rate change preserves elapsed time at the old 2x rate');
    const afterReload = await repository.state(client, id);
    assert.equal(afterReload.clockRate, 2);
    assert.ok(Date.parse(afterReload.gameTime) >= Date.parse(faster.gameTime), 'reload at configured speed continues from saved game time');
    assert.ok(Date.parse(afterReload.gameTime) - Date.parse(faster.gameTime) < 1500, 'reload does not jump the saved clock');
    for (const energy of [50, 100]) {
      await client.query('UPDATE player_stats SET energy=$2 WHERE user_id=$1', [id, energy]);
      const before = await repository.state(client, id);
      await assert.rejects(service.sleep(id, randomUUID()), /below 50%/);
      const after = await repository.state(client, id);
      assert.equal(after.energy, energy);
      assert.ok(Date.parse(after.gameTime) - Date.parse(before.gameTime) < 1000);
    }
    for (const energy of [49, 0]) {
      await client.query('UPDATE player_stats SET energy=$2 WHERE user_id=$1', [id, energy]);
      const before = await repository.state(client, id);
      const key = randomUUID();
      const rested = await service.sleep(id, key);
      assert.equal(rested.energy, 100);
      assert.ok(Math.abs(Date.parse(rested.gameTime) - Date.parse(before.gameTime) - 8 * 3600000) < 1000);
      assert.deepEqual(await service.sleep(id, key), rested);
    }
  } finally {
    await client.query('ROLLBACK'); client.release(); await pool.end();
  }
});
