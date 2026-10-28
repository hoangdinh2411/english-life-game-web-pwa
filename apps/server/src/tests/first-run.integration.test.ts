import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import { AppModule } from '../app.module';
import { DatabaseService } from '../infrastructure/database/database.service';
import { SupabaseTokenVerifier } from '../infrastructure/auth/supabase-token-verifier';

test('ONB-01.2 creates one character, grant and country world with idempotent concurrent replay', async () => {
  const rootUrl = new URL(process.env.TEST_SUPABASE_DATABASE_URL ?? process.env.DATABASE_URL ?? '');
  assert.ok(['127.0.0.1', 'localhost'].includes(rootUrl.hostname));
  const admin = new Pool({ connectionString: rootUrl.toString() });
  const databaseName = `onb012_${randomUUID().replaceAll('-', '')}`;
  const cleanUrl = new URL(rootUrl);
  cleanUrl.pathname = `/${databaseName}`;
  let pool: Pool | undefined;
  try {
    await admin.query(`CREATE DATABASE ${databaseName}`);
    pool = new Pool({ connectionString: cleanUrl.toString() });
    await pool.query(`CREATE SCHEMA auth;
      CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT null::uuid $$;
      CREATE SCHEMA storage;
      CREATE TABLE storage.buckets
        (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);`);
    const migrationDirectory = resolve('../../supabase/migrations');
    for (const file of (await readdir(migrationDirectory)).filter(file => file.endsWith('.sql')).sort()) {
      await pool.query(await readFile(resolve(migrationDirectory, file), 'utf8'));
    }
    const userId = randomUUID();
    const email = 'existing-test@example.invalid';
    await pool.query('INSERT INTO auth.users (id,email,raw_user_meta_data) VALUES ($1,$2,$3)',
      [userId, email, { display_name: 'Existing test player' }]);
    const database = new DatabaseService(new ConfigService({ DATABASE_URL: cleanUrl.toString() }));
    const app = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DatabaseService).useValue(database)
      .overrideProvider(SupabaseTokenVerifier).useValue({ verify: async () => userId })
      .compile();
    const http = app.createNestApplication();
    http.setGlobalPrefix('api/v1');
    await http.listen(0, '127.0.0.1');
    try {
      const base = await http.getUrl() + '/api/v1';
      const headers = { Authorization: 'Bearer existing-token', 'Content-Type': 'application/json' };
      const call = (body: unknown) => fetch(`${base}/characters`, { method: 'POST', headers, body: JSON.stringify(body) });
      const initial = await fetch(`${base}/me`, { headers });
      assert.equal(initial.status, 200);
      assert.equal(((await initial.json()) as { character: unknown }).character, null);

      const valid = { name: '  A\u030Ase-Li  ', countryId: 'country_sweden', gender: 'female' };
      for (const invalid of [
        {}, { name: 'A', countryId: 'country_sweden' }, { name: 'Anne  Marie', countryId: 'country_sweden' },
        { name: 'Valid Name', countryId: 'country_missing' }, { ...valid, avatarId: 'avatar_other' },
        { ...valid, worldId: randomUUID() }, { ...valid, clockRate: 1 }, { ...valid, starterLocationId: 'loc_cafe' },
        { ...valid, energy: 100 },
      ]) assert.equal((await call(invalid)).status, 400);
      assert.equal((await pool.query('SELECT * FROM characters WHERE user_id=$1', [userId])).rowCount, 0);

      const responses = await Promise.all([call(valid), call({ name: 'Åse-Li', countryId: 'country_sweden', gender: 'female' })]);
      assert.deepEqual(responses.map(response => response.status), [201, 201]);
      const states = await Promise.all(responses.map(response => response.json()));
      assert.deepEqual(states[0], states[1]);
      assert.deepEqual(states[0], {
        user: { id: userId, email, displayName: 'Existing test player' },
        character: {
          id: userId, userId, name: 'Åse-Li', gender: 'female', cityId: 'city_maplewood', countryId: 'country_sweden', countryName: 'Sweden',
          avatarId: 'avatar_traveler_01', lastLocation: { mapId: 'loc_station', placeId: 'loc_station', x: 768, y: 370 },
        },
        stats: { xp: 0, coins: 500 }, inventory: [], questProgress: [],
      });
      assert.equal((await call({ name: 'Åse Lo', countryId: 'country_sweden', gender: 'female' })).status, 409);
      assert.equal((await call({ name: ' Åse-Li ', countryId: 'country_sweden', gender: 'female' })).status, 201);
      assert.equal((await call({ name: 'Åse-Li', countryId: 'country_sweden', gender: 'male' })).status, 409);

      const character = (await pool.query(`SELECT name,country_id,current_city_id,current_map_id,current_place_id,
        world_id,outfit,gender FROM characters WHERE user_id=$1`, [userId])).rows[0];
      assert.deepEqual(character, {
        name: 'Åse-Li', country_id: 'country_sweden', current_city_id: 'city_maplewood',
        current_map_id: 'loc_station', current_place_id: 'loc_station', world_id: character.world_id,
        outfit: { avatarId: 'avatar_traveler_01' }, gender: 'female',
      });
      assert.ok(character.world_id);
      assert.equal((await pool.query(`SELECT count(*)::int AS count FROM worlds
        WHERE country_id='country_sweden'`)).rows[0].count, 1);
      assert.equal((await pool.query(`SELECT count(*)::int AS count FROM wallet_ledger
        WHERE user_id=$1 AND idempotency_key='starting_balance'`, [userId])).rows[0].count, 1);
      assert.equal((await pool.query('SELECT coins FROM player_stats WHERE user_id=$1', [userId])).rows[0].coins, 500);
    } finally {
      await http.close();
    }
  } finally {
    await pool?.end();
    await admin.query(`DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`);
    await admin.end();
  }
});
