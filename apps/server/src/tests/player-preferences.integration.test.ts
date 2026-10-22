import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { DatabaseService } from '../infrastructure/database/database.service';
import { PlayersRepository } from '../modules/players/players.repository';

test('T38.1 preferences enforce atomic initialization, bounds, ownership and cascade deletion', async () => {
  const adminUrl = new URL(process.env.TEST_SUPABASE_DATABASE_URL ?? process.env.DATABASE_URL ?? '');
  assert.ok(['127.0.0.1', 'localhost'].includes(adminUrl.hostname));
  assert.equal(adminUrl.port, '54322');
  assert.equal(adminUrl.pathname, '/postgres');

  const admin = new Pool({ connectionString: adminUrl.toString() });
  const databaseName = `t38_preferences_${randomUUID().replaceAll('-', '')}`;
  const databaseUrl = new URL(adminUrl);
  databaseUrl.pathname = `/${databaseName}`;
  let created = false;
  let clean: Pool | undefined;
  let database: DatabaseService | undefined;

  try {
    await admin.query(`CREATE DATABASE ${databaseName}`);
    created = true;
    clean = new Pool({ connectionString: databaseUrl.toString() });
    await clean.query(`CREATE SCHEMA auth;
      CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT null::uuid $$;
      CREATE SCHEMA storage;
      CREATE TABLE storage.buckets
        (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);`);
    const migration = spawnSync(process.execPath, ['scripts/migrate.mjs'], {
      env: { ...process.env, DATABASE_URL: databaseUrl.toString() }, encoding: 'utf8',
    });
    assert.equal(migration.status, 0, migration.stderr);

    database = new DatabaseService(new ConfigService({ DATABASE_URL: databaseUrl.toString() }));
    const players = new PlayersRepository(database, {} as never);
    const userId = randomUUID();
    const otherUserId = randomUUID();
    for (const id of [userId, otherUserId]) {
      await clean.query(
        'INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3)',
        [id, `${id}@example.invalid`, { display_name: 'Preferences fixture' }],
      );
    }

    assert.deepEqual(await players.getPreferences(userId), { preferences: null });
    const candidates = [
      { coachEnabled: true, speechRate: 0.75, speechPitch: 1.25 },
      { coachEnabled: false, speechRate: 1.5, speechPitch: 0.75 },
    ] as const;
    const initialized = await Promise.all(candidates.map(candidate => players.initializePreferences(userId, candidate)));
    const winner = initialized[0];
    assert.ok(winner);
    assert.deepEqual(winner, initialized[1]);
    assert.ok(candidates.some(candidate => candidate.coachEnabled === winner.coachEnabled
      && candidate.speechRate === winner.speechRate && candidate.speechPitch === winner.speechPitch));

    const updated = await players.updatePreferences(userId, { speechRate: 1.2 });
    assert.equal(updated.speechRate, 1.2);
    assert.equal(updated.coachEnabled, winner.coachEnabled);
    assert.equal(updated.speechPitch, winner.speechPitch);
    assert.deepEqual(await players.getPreferences(otherUserId), { preferences: null });

    for (const [column, value] of [['speech_rate', 0.74], ['speech_rate', 1.51], ['speech_pitch', 0.74], ['speech_pitch', 1.26]] as const) {
      await assert.rejects(clean.query(`UPDATE player_preferences SET ${column}=$1 WHERE user_id=$2`, [value, userId]), { code: '23514' });
    }

    const restricted = await clean.connect();
    try {
      await restricted.query('BEGIN');
      await restricted.query('SET LOCAL ROLE authenticated');
      await restricted.query('SAVEPOINT denied_read');
      await assert.rejects(restricted.query('SELECT * FROM player_preferences'), { code: '42501' });
      await restricted.query('ROLLBACK TO SAVEPOINT denied_read');
      await assert.rejects(restricted.query('UPDATE player_preferences SET coach_enabled=true WHERE user_id=$1', [userId]), { code: '42501' });
    } finally {
      await restricted.query('ROLLBACK');
      restricted.release();
    }

    await clean.query('DELETE FROM auth.users WHERE id=$1', [userId]);
    assert.equal((await clean.query('SELECT * FROM player_preferences WHERE user_id=$1', [userId])).rowCount, 0);
  } finally {
    await database?.onApplicationShutdown();
    await clean?.end();
    if (created) await admin.query(`DROP DATABASE ${databaseName}`);
    await admin.end();
  }
});
