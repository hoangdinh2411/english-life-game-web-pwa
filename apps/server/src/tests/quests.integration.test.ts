import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient } from 'pg';
import { ConflictException } from '@nestjs/common';
import { DatabaseService } from '../infrastructure/database/database.service';
import { loadSeedContent } from '../infrastructure/content/seed-content';
import { seedContent } from '../infrastructure/content/seed.repository';
import { EconomyService } from '../modules/economy/economy.service';
import { ArrivalProgress, QuestsRepository } from '../modules/quests/quests.repository';
import { QuestsService } from '../modules/quests/quests.service';
import { ARRIVAL_NPC_ID, ARRIVAL_QUEST_ID } from '@life-abroad/shared';

test('T5 ordered arrival, persisted entitlement, concurrent retries, atomic reward and permissions', async () => {
  const url = new URL(process.env.TEST_SUPABASE_DATABASE_URL ?? process.env.DATABASE_URL ?? '');
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname));
  assert.equal(url.port, '55422');
  assert.equal(url.pathname, '/postgres');
  const admin = new Pool({ connectionString: url.toString() });
  const name = 't5_test_' + randomUUID().replaceAll('-', '');
  const cleanUrl = new URL(url);
  cleanUrl.pathname = '/' + name;
  let created = false;
  let clean: Pool | undefined;
  let database: DatabaseService | undefined;
  try {
    await admin.query(`CREATE DATABASE ${name}`);
    created = true;
    clean = new Pool({ connectionString: cleanUrl.toString() });
    await clean.query(`CREATE SCHEMA auth;
      CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT null::uuid $$;`);
    const migrated = spawnSync(process.execPath, ['scripts/migrate.mjs'], {
      env: { ...process.env, DATABASE_URL: cleanUrl.toString() }, encoding: 'utf8',
    });
    assert.equal(migrated.status, 0, migrated.stderr);
    database = new DatabaseService(new ConfigService({ DATABASE_URL: cleanUrl.toString() }));
    const content = await loadSeedContent(resolve('../../content'));
    await database.transaction(client => seedContent(client, content));
    const repository = new QuestsRepository(database);
    const economy = new EconomyService();
    let quests = new QuestsService(repository, economy);
    const userId = randomUUID();
    const otherUserId = randomUUID();
    for (const id of [userId, otherUserId]) {
      await clean.query('INSERT INTO auth.users (id,email,raw_user_meta_data) VALUES ($1,$2,$3)', [id, id + '@example.invalid', {}]);
    }
    await assert.rejects(quests.getArrival(otherUserId), ConflictException);
    await clean.query('INSERT INTO characters (user_id,name,current_city_id) VALUES ($1,$2,$3)', [userId, 'T5 learner', 'city_maplewood']);
    await clean.query('UPDATE player_stats SET xp=23,coins=7 WHERE user_id=$1', [userId]);
    const initial = await quests.getArrival(userId);
    assert.equal(initial.status, 'not_started');
    assert.equal(initial.locationId, 'loc_station');
    assert.equal(initial.canEnterTownStreet, false);
    for (const operation of [() => quests.issueArrivalTicket(userId), () => quests.enterTownStreet(userId),
      () => quests.applyReceptionistIntent(userId, ARRIVAL_NPC_ID, 'request_bus_ticket')]) {
      await assert.rejects(operation(), ConflictException);
      assert.deepEqual(await quests.getArrival(userId), initial);
    }
    assert.deepEqual(await quests.applyReceptionistIntent(userId, 'npc_mia', 'greet'), initial);
    assert.deepEqual(await quests.applyReceptionistIntent(userId, ARRIVAL_NPC_ID, 'obtain_bus_ticket'), initial);
    assert.deepEqual(await quests.applyReceptionistIntent(userId, ARRIVAL_NPC_ID, 'unknown'), initial);
    await Promise.all(Array.from({ length: 8 }, () => quests.applyReceptionistIntent(userId, ARRIVAL_NPC_ID, 'greet')));
    const greeted = await quests.getArrival(userId);
    assert.equal(greeted.currentStepId, 'arrival_ask');
    await assert.rejects(quests.issueArrivalTicket(userId), ConflictException);
    await Promise.all(Array.from({ length: 8 }, (_, index) => quests.applyReceptionistIntent(userId, ARRIVAL_NPC_ID,
      index % 2 ? 'request_bus_ticket' : 'ask_town_directions')));
    assert.equal((await quests.getArrival(userId)).currentStepId, 'arrival_ticket');
    await assert.rejects(quests.enterTownStreet(userId), ConflictException);
    await Promise.all(Array.from({ length: 8 }, () => quests.issueArrivalTicket(userId)));
    const ticket = await quests.getArrival(userId);
    assert.equal(ticket.currentStepId, 'arrival_exit');
    assert.deepEqual(ticket.ticket, { issued: true, used: false });
    assert.equal(ticket.canEnterTownStreet, true);
    const issuedAt = (await clean.query('SELECT bus_ticket_issued_at FROM player_quests WHERE user_id=$1', [userId])).rows[0].bus_ticket_issued_at as Date;
    await quests.issueArrivalTicket(userId);
    assert.deepEqual((await clean.query('SELECT bus_ticket_issued_at FROM player_quests WHERE user_id=$1', [userId])).rows[0].bus_ticket_issued_at, issuedAt);
    // A new pool and service stand in for a restarted process or a new signed-in session.
    await database.onApplicationShutdown();
    database = new DatabaseService(new ConfigService({ DATABASE_URL: cleanUrl.toString() }));
    quests = new QuestsService(new QuestsRepository(database), economy);
    assert.deepEqual(await quests.getArrival(userId), ticket);

    class FailingRepository extends QuestsRepository {
      override async save(client: PoolClient, id: string, progress: ArrivalProgress): Promise<void> {
        await super.save(client, id, progress);
        if (progress.status === 'done') throw new Error('injected completion failure');
      }
    }
    const failing = new QuestsService(new FailingRepository(database), economy);
    await assert.rejects(failing.enterTownStreet(userId), /injected completion failure/);
    assert.deepEqual(await quests.getArrival(userId), ticket);
    assert.deepEqual((await clean.query('SELECT xp,coins FROM player_stats WHERE user_id=$1', [userId])).rows[0], { xp: 23, coins: 7 });
    assert.equal((await clean.query('SELECT * FROM quest_reward_claims WHERE user_id=$1', [userId])).rowCount, 0);
    const exits = await Promise.all(Array.from({ length: 12 }, () => quests.enterTownStreet(userId)));
    const done = exits[0];
    assert.ok(done);
    assert.equal(done.status, 'done');
    assert.equal(done.currentStepId, null);
    assert.equal(done.locationId, 'loc_town_street');
    assert.deepEqual(done.ticket, { issued: true, used: true });
    assert.equal(done.rewardsGranted, true);
    for (const state of exits) assert.deepEqual(state, done);
    const reward = content.quests.find(quest => quest.id === ARRIVAL_QUEST_ID)?.rewards;
    assert.ok(reward);
    assert.deepEqual((await clean.query('SELECT xp,coins FROM player_stats WHERE user_id=$1', [userId])).rows[0], { xp: 23 + reward.xp, coins: 7 + reward.coins });
    assert.equal((await clean.query('SELECT * FROM quest_reward_claims WHERE user_id=$1 AND quest_id=$2', [userId, ARRIVAL_QUEST_ID])).rowCount, 1);
    assert.deepEqual(await quests.issueArrivalTicket(userId), done);
    assert.deepEqual(await quests.applyReceptionistIntent(userId, ARRIVAL_NPC_ID, 'greet'), done);
    await database.transaction(async client => { await economy.grantQuestReward(client, userId, content.quests.find(quest => quest.id === ARRIVAL_QUEST_ID)!); });
    assert.deepEqual((await clean.query('SELECT xp,coins FROM player_stats WHERE user_id=$1', [userId])).rows[0], { xp: 23 + reward.xp, coins: 7 + reward.coins });
    assert.equal((await clean.query('SELECT * FROM player_quests WHERE user_id=$1', [otherUserId])).rowCount, 0);
    for (const sql of ['UPDATE player_quests SET bus_ticket_issued_at=now()', 'INSERT INTO quest_reward_claims (user_id,quest_id,xp,coins) VALUES ($1,$2,999,999)']) {
      await assert.rejects(database.transaction(async client => {
        await client.query('SET LOCAL ROLE authenticated');
        await client.query(sql, sql.startsWith('INSERT') ? [userId, ARRIVAL_QUEST_ID] : []);
      }), { code: '42501' });
    }
    await assert.rejects(clean.query('UPDATE player_quests SET bus_ticket_issued_at=null WHERE user_id=$1', [userId]), { code: '23514' });
  } finally {
    await database?.onApplicationShutdown();
    await clean?.end();
    if (created) await admin.query(`DROP DATABASE ${name}`);
    await admin.end();
  }
});
