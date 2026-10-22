import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { DatabaseService } from '../infrastructure/database/database.service';
import { loadSeedContent } from '../infrastructure/content/seed-content';
import { seedContent } from '../infrastructure/content/seed.repository';
import { DialogueCacheService } from '../infrastructure/content/dialogue-cache.service';
import { DialogueService } from '../modules/dialogue/dialogue.service';
import { resolve } from 'node:path';
import { readdirSync } from 'node:fs';
import { ShopsService } from '../modules/shops/shops.service';
import type { ShopItem } from '@life-abroad/shared';

test('R2/T2 clean migrations and seed, cache, character writes, rollback, RLS and shutdown', async () => {
  const url = new URL(process.env.TEST_SUPABASE_DATABASE_URL ?? process.env.DATABASE_URL ?? '');
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname));
  assert.equal(url.port, '54322');
  assert.equal(url.pathname, '/postgres');
  const admin = new Pool({ connectionString: url.toString() });
  const name = 'r2_test_' + randomUUID().replaceAll('-', '');
  const cleanUrl = new URL(url);
  cleanUrl.pathname = '/' + name;
  let created = false;
  let clean: Pool | undefined;
  const database = new DatabaseService(new ConfigService({ DATABASE_URL: url.toString() }));
  try {
    await admin.query(`CREATE DATABASE ${name}`);
    created = true;
    clean = new Pool({ connectionString: cleanUrl.toString() });
    // Supabase owns Auth. Supply only migration prerequisites in the empty test DB.
    await clean.query(`CREATE SCHEMA auth;
      CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT null::uuid $$;`);
    // Minimal Storage prerequisite for the bucket migration in this isolated SQL database.
    await clean.query(`CREATE SCHEMA storage; CREATE TABLE storage.buckets
      (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);`);
    for (let attempt = 0; attempt < 2; attempt++) {
      const migration = spawnSync(process.execPath, ['scripts/migrate.mjs'], {
        env: { ...process.env, DATABASE_URL: cleanUrl.toString() }, encoding: 'utf8',
      });
      assert.equal(migration.status, 0, migration.stderr);
    }
    const migrationCount = readdirSync(resolve('migrations')).filter(file => file.endsWith('.sql')).length;
    assert.equal((await clean.query('SELECT * FROM schema_migrations')).rowCount, migrationCount);
    assert.equal((await clean.query('SELECT * FROM countries')).rowCount, 247);
    assert.equal((await clean.query(`SELECT count(*)::int AS count FROM countries
      WHERE starter_city_id='city_maplewood' AND starter_location_id='loc_station'`)).rows[0].count, 247);
    assert.equal((await clean.query(`SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='countries' AND column_name='flag'`)).rowCount, 0);
    assert.equal((await clean.query('SELECT * FROM worlds')).rowCount, 0);
    const countryId = (await clean.query('SELECT id FROM countries ORDER BY id LIMIT 1')).rows[0].id as string;
    const creations = await Promise.all([
      clean.query('INSERT INTO worlds (country_id) VALUES ($1) ON CONFLICT (country_id) DO NOTHING RETURNING id', [countryId]),
      clean.query('INSERT INTO worlds (country_id) VALUES ($1) ON CONFLICT (country_id) DO NOTHING RETURNING id', [countryId]),
    ]);
    assert.equal(creations.reduce((count, result) => count + (result.rowCount ?? 0), 0), 1);
    assert.equal((await clean.query('SELECT * FROM worlds WHERE country_id=$1', [countryId])).rowCount, 1);
    const world = (await clean.query('SELECT id, clock_start_utc, clock_rate FROM worlds WHERE country_id=$1', [countryId])).rows[0];
    assert.ok(world.clock_start_utc);
    assert.equal(world.clock_rate, 6);
    for (const update of [
      ['UPDATE worlds SET country_id=(SELECT id FROM countries WHERE id<>$1 ORDER BY id LIMIT 1) WHERE id=$2', [countryId, world.id]],
      ['UPDATE worlds SET clock_start_utc=clock_start_utc + interval \'1 second\' WHERE id=$1', [world.id]],
      ['UPDATE worlds SET clock_rate=7 WHERE id=$1', [world.id]],
    ] as const) await assert.rejects(clean.query(update[0], [...update[1]]), /immutable|check constraint/);
    const content = await loadSeedContent(resolve('../../content'));
    const seedDatabase = new DatabaseService(new ConfigService({ DATABASE_URL: cleanUrl.toString() }));
    let seedClosed = false;
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const seed = spawnSync(process.execPath, ['scripts/seed.mjs'], {
          env: { ...process.env, DATABASE_URL: cleanUrl.toString() }, encoding: 'utf8',
        });
        assert.equal(seed.status, 0, seed.stderr);
      }
      assert.equal((await clean.query('SELECT * FROM npcs')).rowCount, content.npcs.length);
      assert.equal((await clean.query('SELECT * FROM mood_types')).rowCount, content.moods.length);
      assert.equal((await clean.query("SELECT current_mood_id FROM npcs WHERE id='npc_mia'")).rows[0].current_mood_id, 'neutral');
      assert.deepEqual(
        (await clean.query(`SELECT gender, profile, portrait_image_url, portrait_index, portrait_columns, portrait_rows
          FROM npcs WHERE id=$1`, ['npc_nora_bookseller'])).rows[0],
        {
          gender: 'female',
          profile: content.npcs.find(npc => npc.id === 'npc_nora_bookseller')!.profile,
          portrait_image_url: 'npcs/npc_nora_bookseller/portraits.png',
          portrait_index: 0,
          portrait_columns: 3,
          portrait_rows: 1,
        },
      );
      assert.equal((await clean.query('SELECT * FROM quests')).rowCount, content.quests.length);
      assert.equal((await clean.query('SELECT * FROM quest_steps')).rowCount, content.quests.reduce((count, quest) => count + quest.steps.length, 0));
      assert.deepEqual((await clean.query('SELECT rewards FROM quests WHERE id=$1', ['q_order_coffee'])).rows[0].rewards, { xp: 20, coins: 5 });
      assert.deepEqual((await clean.query<ShopItem>('SELECT id,name,kind,price,shop,color FROM shop_items ORDER BY id')).rows.map(({ color, ...item }) => ({ ...item, ...(color ? { color } : {}) })),
        [...content.shops].sort((a, b) => a.id.localeCompare(b.id)));
      // Prices here are isolated fixtures, never the owner-authored live catalog.
      const fixtureItems: ShopItem[] = [
        { id: 'test_drink', name: 'Test drink', kind: 'drink', price: 2, shop: 'cafe' },
        { id: 'test_food', name: 'Test food', kind: 'food', price: 3, shop: 'cafe' },
        { id: 'test_shirt', name: 'Test shirt', kind: 'clothing', price: 10, shop: 'clothes' },
      ];
      for (let attempt = 0; attempt < 2; attempt++) {
        await seedDatabase.transaction(client => seedContent(client, { ...content, shops: fixtureItems }));
      }
      const shops = new ShopsService(seedDatabase);
      const cafe = await shops.listItems('cafe');
      assert.deepEqual(cafe.filter(item => item.id.startsWith('test_')), fixtureItems.slice(0, 2));
      assert.deepEqual((await shops.listItems('clothes')).filter(item => item.id.startsWith('test_')), [fixtureItems[2]]);
      await clean.query('UPDATE shop_items SET price=4 WHERE id=$1', ['test_drink']);
      assert.equal((await shops.listItems('cafe')).find(item => item.id === 'test_drink')?.price, 4);
      await assert.rejects(seedDatabase.transaction(async client => {
        await seedContent(client, { ...content, shops: fixtureItems });
        throw new Error('shop seed rollback');
      }), /shop seed rollback/);
      assert.equal((await shops.listItems('cafe')).find(item => item.id === 'test_drink')?.price, 4);
      const permissionClient = await clean.connect();
      try {
        await permissionClient.query('BEGIN');
        await permissionClient.query('SET LOCAL ROLE authenticated');
        await assert.rejects(permissionClient.query('SELECT * FROM shop_items'), { code: '42501' });
      } finally {
        await permissionClient.query('ROLLBACK');
        permissionClient.release();
      }
      const cache = new DialogueCacheService(seedDatabase);
      const [nodes, sameNodes] = await Promise.all([cache.getNodes(), cache.getNodes()]);
      assert.equal(nodes.length, content.dialogues.reduce((count, file) => count + file.nodes.length, 0));
      assert.deepEqual(nodes, sameNodes);
      for (const file of content.dialogues) for (const node of file.nodes) {
        const seeded = nodes.find(entry => entry.node.id === node.id);
        assert.deepEqual(seeded?.node, node);
        assert.equal(seeded?.scope, file.scope);
        assert.equal(seeded?.version, file.version);
        assert.equal(seeded?.npcId, file.scope === 'npc' ? file.npcId : null);
        assert.equal(seeded?.roleId, file.scope === 'role' ? file.role : null);
      }
      await assert.rejects(seedDatabase.transaction(async client => {
        await seedContent(client, { ...content, town: { ...content.town, name: 'Must roll back' } });
        throw new Error('intentional seed rollback');
      }), /intentional seed rollback/);
      assert.equal((await clean.query('SELECT name FROM cities WHERE id=$1', [content.town.id])).rows[0].name, content.town.name);
      await assert.rejects(clean.query(`INSERT INTO dialogue_nodes (id,scope,npc_text,next_rules,version)
        VALUES ('bad','npc','{"default":"Hi"}','{}',1)`), { code: '23514' });
      await assert.rejects(clean.query(`INSERT INTO dialogue_nodes (id,scope,npc_id,npc_text,next_rules,version)
        VALUES ('bad','npc','missing','{"default":"Hi"}','{}',1)`), { code: '23503' });
      await seedDatabase.onApplicationShutdown();
      seedClosed = true;
      // Cached retrieval still works after closing the pool: no query per line.
      nodes[0]!.node.text.default = 'Caller mutation';
      assert.deepEqual(await cache.getNodes(), sameNodes);
      const engine = new DialogueService(cache);
      const receptionist = { npcId: 'npc_receptionist', roleId: 'station_receptionist', personality: 'cheerful' };
      assert.equal((await engine.reply(receptionist, 'Could I have a bus ticket, please?')).node.id, 'receptionist_ticket_request');
      assert.equal((await engine.reply(receptionist, 'How do I get to town?')).intent, 'ask_town_directions');
      assert.equal((await engine.reply(receptionist, 'unrelated words')).intent, null);
    } finally { if (!seedClosed) await seedDatabase.onApplicationShutdown(); }
    const userId = randomUUID();
    const cityId = 'r2_fixture_' + randomUUID();
    await assert.rejects(database.transaction(async client => {
      await client.query('INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3)',
        [userId, userId + '@example.invalid', { display_name: 'R2 fixture' }]);
      assert.equal((await client.query('SELECT english_level FROM profiles WHERE id = $1', [userId])).rows[0].english_level, null);
      const stats = await client.query('SELECT energy, last_energy_update, coins, xp FROM player_stats WHERE user_id = $1', [userId]);
      assert.deepEqual(stats.rows[0], { energy: null, last_energy_update: null, coins: 0, xp: 0 });
      await client.query('INSERT INTO cities (id, name) VALUES ($1, $2)', [cityId, 'Test fixture']);
      await client.query('INSERT INTO characters (user_id, name, current_city_id) VALUES ($1, $2, $3)', [userId, 'R2 character', cityId]);
      assert.equal((await client.query('SELECT name FROM characters WHERE user_id = $1', [userId])).rows[0].name, 'R2 character');
      await client.query('SAVEPOINT duplicate_check');
      await assert.rejects(client.query('INSERT INTO characters (user_id, name) VALUES ($1, $2)', [userId, 'Duplicate']), { code: '23505' });
      await client.query('ROLLBACK TO SAVEPOINT duplicate_check');
      await client.query('SAVEPOINT stats_check');
      await assert.rejects(client.query('UPDATE player_stats SET coins = -1 WHERE user_id = $1', [userId]), { code: '23514' });
      await client.query('ROLLBACK TO SAVEPOINT stats_check');
      await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [randomUUID()]);
      await client.query('SET LOCAL ROLE authenticated');
      assert.equal((await client.query('SELECT * FROM characters WHERE user_id = $1', [userId])).rowCount, 0);
      await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [userId]);
      assert.equal((await client.query('SELECT * FROM characters WHERE user_id = $1', [userId])).rowCount, 1);
      await client.query('SAVEPOINT write_check');
      await assert.rejects(client.query('UPDATE characters SET name = $1 WHERE user_id = $2', ['Forbidden', userId]), { code: '42501' });
      await client.query('ROLLBACK TO SAVEPOINT write_check');
      await client.query('RESET ROLE');
      throw new Error('intentional fixture rollback');
    }), /intentional fixture rollback/);
    assert.equal((await database.query('SELECT * FROM characters WHERE user_id = $1', [userId])).rowCount, 0);
    assert.equal((await database.query('SELECT * FROM auth.users WHERE id = $1', [userId])).rowCount, 0);
    assert.equal(await database.transaction(async client => (await client.query('SELECT 42 AS answer')).rows[0].answer as number), 42);
  } finally {
    await database.onApplicationShutdown();
    await clean?.end();
    if (created) await admin.query(`DROP DATABASE ${name}`);
    await admin.end();
  }
  await assert.rejects(database.query('SELECT 1'), /pool after calling end/);
});
