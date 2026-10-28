import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';

test('ONB-01.1 migrates the canonical catalog and protects one immutable world per country', async () => {
  const url = new URL(process.env.TEST_SUPABASE_DATABASE_URL ?? process.env.DATABASE_URL ?? '');
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname));
  assert.equal(url.pathname, '/postgres');
  const admin = new Pool({ connectionString: url.toString() });
  const databaseName = `onb011_${randomUUID().replaceAll('-', '')}`;
  const cleanUrl = new URL(url);
  cleanUrl.pathname = `/${databaseName}`;
  let database: Pool | undefined;
  try {
    await admin.query(`CREATE DATABASE ${databaseName}`);
    database = new Pool({ connectionString: cleanUrl.toString() });
    await database.query(`CREATE SCHEMA auth;
      CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT null::uuid $$;
      CREATE SCHEMA storage;
      CREATE TABLE storage.buckets
        (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);`);
    const migrationDirectory = resolve('../../supabase/migrations');
    const migrations = (await readdir(migrationDirectory)).filter(file => file.endsWith('.sql')).sort();
    for (const file of migrations.filter(file => file < '032_country_clock_worlds.sql')) {
      await database.query(await readFile(resolve(migrationDirectory, file), 'utf8'));
    }

    const userId = randomUUID();
    await database.query(`INSERT INTO cities (id,name) VALUES ('city_maplewood','Starter City');
      INSERT INTO locations (id,city_id,name,type) VALUES ('loc_station','city_maplewood','Train Station','station');
      INSERT INTO countries (id,name,iso_code,flag,time_zone,starter_city_id)
        VALUES ('country_sweden','Sweden','SE','🇸🇪','Europe/Stockholm','city_maplewood');`);
    await database.query('INSERT INTO auth.users (id,email,raw_user_meta_data) VALUES ($1,$2,$3)',
      [userId, 'legacy@example.invalid', { display_name: 'Legacy' }]);
    await database.query(`INSERT INTO characters
      (user_id,name,country_id,current_city_id,current_map_id,current_place_id,current_position_x,current_position_y)
      VALUES ($1,'Legacy learner','country_sweden','city_maplewood','loc_station','loc_station',768,370)`, [userId]);

    await database.query(await readFile(resolve(migrationDirectory, '032_country_clock_worlds.sql'), 'utf8'));
    assert.equal((await database.query('SELECT count(*)::int AS count FROM countries')).rows[0].count, 247);
    assert.equal((await database.query(`SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='countries' AND column_name='flag'`)).rowCount, 0);
    const legacy = (await database.query(`SELECT characters.world_id, worlds.country_id, worlds.clock_rate
      FROM characters JOIN worlds ON worlds.id=characters.world_id WHERE characters.user_id=$1`, [userId])).rows[0];
    assert.equal(legacy.country_id, 'country_sweden');
    assert.equal(legacy.clock_rate, 6);

    const creations = await Promise.all([
      database.query(`INSERT INTO worlds (country_id) VALUES ('country_albania')
        ON CONFLICT (country_id) DO NOTHING RETURNING id`),
      database.query(`INSERT INTO worlds (country_id) VALUES ('country_albania')
        ON CONFLICT (country_id) DO NOTHING RETURNING id`),
    ]);
    assert.equal(creations.reduce((count, result) => count + (result.rowCount ?? 0), 0), 1);
    const world = (await database.query(`SELECT id, clock_start_utc FROM worlds
      WHERE country_id='country_albania'`)).rows[0];
    assert.ok(world.clock_start_utc);
    await assert.rejects(database.query('UPDATE worlds SET clock_rate=7 WHERE id=$1', [world.id]), /immutable|check constraint/);
    await assert.rejects(database.query(`UPDATE worlds SET country_id='country_algeria' WHERE id=$1`, [world.id]), /immutable/);
    await assert.rejects(database.query(`UPDATE worlds SET clock_start_utc=now() WHERE id=$1`, [world.id]), /immutable/);
  } finally {
    await database?.end();
    await admin.query(`DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`);
    await admin.end();
  }
});
