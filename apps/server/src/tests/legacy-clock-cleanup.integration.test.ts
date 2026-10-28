import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { Pool } from 'pg';

test('033 drops only per-player clock columns and preserves appearance and action data', async () => {
  const url = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.port, '54322');
  const pool = new Pool({ connectionString: url.toString() });
  const client = await pool.connect();
  const schema = `clock_cleanup_${randomUUID().replaceAll('-', '')}`;
  try {
    await client.query('BEGIN');
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`CREATE TABLE ${schema}.player_life (
      user_id uuid primary key,
      clock_time timestamptz not null,
      clock_anchor timestamptz not null,
      clock_rate integer not null,
      hair text not null,
      shirt text,
      trousers text not null
    )`);
    await client.query(`CREATE TABLE ${schema}.player_actions (
      user_id uuid not null,
      key uuid not null,
      response jsonb not null
    )`);
    const userId = randomUUID(), actionKey = randomUUID();
    await client.query(`INSERT INTO ${schema}.player_life
      (user_id,clock_time,clock_anchor,clock_rate,hair,shirt,trousers)
      VALUES ($1,now(),now(),2,'black','blue','navy')`, [userId]);
    await client.query(`INSERT INTO ${schema}.player_actions (user_id,key,response)
      VALUES ($1,$2,$3)`, [userId, actionKey, { energy: 79 }]);
    const migration = await readFile(resolve('../../supabase/migrations/033_remove_per_player_clock.sql'), 'utf8');
    await client.query(migration.replace('public.player_life', `${schema}.player_life`));
    const columns = await client.query<{ column_name: string }>(`SELECT column_name
      FROM information_schema.columns WHERE table_schema=$1 AND table_name='player_life'
      ORDER BY ordinal_position`, [schema]);
    assert.deepEqual(columns.rows.map(row => row.column_name), ['user_id', 'hair', 'shirt', 'trousers']);
    assert.deepEqual((await client.query(`SELECT hair,shirt,trousers FROM ${schema}.player_life WHERE user_id=$1`,
      [userId])).rows[0], { hair: 'black', shirt: 'blue', trousers: 'navy' });
    assert.deepEqual((await client.query(`SELECT response FROM ${schema}.player_actions WHERE user_id=$1 AND key=$2`,
      [userId, actionKey])).rows[0]?.response, { energy: 79 });
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  }
});
