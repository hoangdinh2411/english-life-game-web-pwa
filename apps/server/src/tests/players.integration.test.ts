import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import { AppModule } from '../app.module';
import { PlayersRepository } from '../modules/players/players.repository';
import { ServiceUnavailableException } from '@nestjs/common';
import { QuestsService } from '../modules/quests/quests.service';
import { ARRIVAL_NPC_ID, arrivalStateSchema } from '@life-abroad/shared';
import { EconomyService } from '../modules/economy/economy.service';
import { PlayersService } from '../modules/players/players.service';
import { OnboardingService } from '../modules/onboarding/onboarding.service';

// Real Auth, HTTP and SQL catch missing transactions, duplicate creation and balance resets.
test('R4 real onboarding, validation, concurrent creation and account resume', async () => {
  const databaseUrl = process.env.DATABASE_URL ?? '';
  const authUrl = process.env.SUPABASE_URL ?? '';
  assert.equal(new URL(databaseUrl).hostname, '127.0.0.1');
  assert.equal(new URL(databaseUrl).port, '55422');
  assert.equal(new URL(authUrl).hostname, '127.0.0.1');
  const database = new Pool({ connectionString: databaseUrl });
  const auth = createClient(authUrl, process.env.SUPABASE_PUBLISHABLE_KEY ?? '', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const email = `r4-${randomUUID()}@example.com`;
  const password = randomUUID();
  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix('api/v1');
  let userId: string | undefined;
  try {
    await app.listen(0, '127.0.0.1');
    const signed = await auth.auth.signUp({ email, password, options: { data: { display_name: 'R4 learner' } } });
    assert.equal(signed.error, null);
    userId = signed.data.user?.id;
    assert.ok(userId);
    assert.ok(signed.data.session);
    const headers = { Authorization: `Bearer ${signed.data.session.access_token}`, 'Content-Type': 'application/json' };
    const base = await app.getUrl() + '/api/v1';
    const call = (path: string, body?: unknown) => fetch(base + path, {
      headers, method: body === undefined ? 'GET' : 'POST',
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const initial = await call('/me');
    assert.equal(initial.status, 200);
    const before = await initial.json() as { character: unknown; stats: unknown; user: { id: string } };
    assert.equal(before.character, null);
    assert.deepEqual(before.stats, { xp: 0, coins: 0 });
    assert.equal(before.user.id, userId);
    await database.query('UPDATE player_stats SET xp = 23, coins = 7 WHERE user_id = $1', [userId]);
    const optionsResponse = await call('/onboarding/options');
    const options = await optionsResponse.json() as { cities: Array<{ id: string }>; avatars: Array<{ id: string }> };
    assert.ok(options.cities[0]); assert.ok(options.avatars[0]);
    const request = { name: '  R4 Learner  ', cityId: options.cities[0].id, avatarId: options.avatars[0].id };
    for (const body of [null, {}, { ...request, xp: 999 }, { ...request, userId }, { ...request, name: ' ' },
      { ...request, name: 'a'.repeat(2001) }, { ...request, cityId: 'city_unknown' }, { ...request, avatarId: 'avatar_unknown' }]) {
      assert.equal((await call('/characters', body)).status, 400);
    }
    assert.equal((await database.query('SELECT * FROM characters WHERE user_id = $1', [userId])).rowCount, 0);
    // Fail the response read after INSERT: the real transaction must roll back.
    const repository = app.get(PlayersRepository);
    const readPlayer = repository.getPlayer.bind(repository);
    let reads = 0;
    repository.getPlayer = async (...args) => {
      if (++reads === 2) throw new ServiceUnavailableException('Injected read failure');
      return readPlayer(...args);
    };
    try { assert.equal((await call('/characters', request)).status, 503); }
    finally { repository.getPlayer = readPlayer; }
    assert.equal((await database.query('SELECT * FROM characters WHERE user_id = $1', [userId])).rowCount, 0);
    assert.deepEqual(((await (await call('/me')).json()) as { stats: unknown }).stats, { xp: 23, coins: 7 });
    const responses = await Promise.all([call('/characters', request), call('/characters', request)]);
    assert.deepEqual(responses.map(response => response.status).sort(), [201, 409]);
    const created = await responses.find(response => response.status === 201)!.json();
    assert.deepEqual(created, {
      user: { id: userId, email, displayName: 'R4 learner' },
      character: { id: userId, userId, ...request, lastLocation: { mapId: 'loc_station', placeId: 'loc_station', x: 768, y: 370 } },
      stats: { xp: 23, coins: 507 }, inventory: [], questProgress: [],
    });
    assert.equal((await call('/characters', request)).status, 409);
    assert.equal((await database.query('SELECT * FROM characters WHERE user_id = $1', [userId])).rowCount, 1);
    const state = await database.query('SELECT xp, coins, energy, last_energy_update FROM player_stats WHERE user_id = $1', [userId]);
    assert.deepEqual(state.rows[0], { xp: 23, coins: 507, energy: null, last_energy_update: null });
    const refresh = await auth.auth.refreshSession();
    assert.equal(refresh.error, null);
    assert.ok(refresh.data.session);
    headers.Authorization = `Bearer ${refresh.data.session.access_token}`;
    const expected = { user: created.user, character: created.character, stats: created.stats };
    assert.deepEqual(await (await call('/me')).json(), expected);
    const economy = app.get(EconomyService);
    await assert.rejects(economy.spend(userId, 508, 'order', 'too-large'), /Insufficient funds/);
    assert.equal(await economy.spend(userId, 7, 'order', 'first'), 500);
    assert.equal(await economy.spend(userId, 7, 'order', 'first'), 500);
    await assert.rejects(economy.spend(userId, 8, 'order', 'first'), /another operation/);
    const concurrent = await Promise.allSettled([
      economy.spend(userId, 300, 'order', 'second'), economy.spend(userId, 300, 'order', 'third'),
    ]);
    assert.equal(concurrent.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(concurrent.filter(result => result.status === 'rejected').length, 1);
    const replay = await Promise.all([
      economy.spend(userId, 100, 'order', 'same'), economy.spend(userId, 100, 'order', 'same'),
    ]);
    assert.deepEqual(replay, [100, 100]);
    for (const amount of [0, -1, 0.5, NaN, Infinity]) {
      await assert.rejects(economy.spend(userId, amount, 'order', randomUUID()), /Invalid wallet charge/);
    }
    assert.equal((await database.query('SELECT count(*)::int AS count FROM wallet_ledger WHERE user_id=$1', [userId])).rows[0].count, 4);
    expected.stats.coins = 100;
    await auth.auth.signOut();
    const login = await auth.auth.signInWithPassword({ email, password });
    assert.equal(login.error, null);
    assert.ok(login.data.session);
    headers.Authorization = `Bearer ${login.data.session.access_token}`;
    assert.deepEqual(await (await call('/me')).json(), expected);
    // T5 quest state follows the verified account across refresh and sign-in.
    const quests = app.get(QuestsService);
    await quests.applyReceptionistIntent(userId, ARRIVAL_NPC_ID, 'greet');
    await quests.applyReceptionistIntent(userId, ARRIVAL_NPC_ID, 'request_bus_ticket');
    await quests.issueArrivalTicket(userId);
    const ticket = arrivalStateSchema.parse(await (await call('/quests/arrival')).json());
    assert.equal(ticket.ticket.issued, true);
    assert.equal(ticket.ticket.used, false);
    await auth.auth.signOut();
    const resumed = await auth.auth.signInWithPassword({ email, password });
    assert.equal(resumed.error, null);
    assert.ok(resumed.data.session);
    headers.Authorization = `Bearer ${resumed.data.session.access_token}`;
    assert.deepEqual(await (await call('/quests/arrival')).json(), ticket);
    const exit = await call('/quests/arrival/enter-town-street', {});
    assert.equal(exit.status, 201);
    const arrival = arrivalStateSchema.parse(await exit.json());
    assert.equal(arrival.status, 'done');
    assert.equal(arrival.locationId, 'loc_town_street');
    assert.equal(arrival.rewardsGranted, true);
    assert.deepEqual(await (await call('/quests/arrival/enter-town-street', {})).json(), arrival);
    const earned = await database.query<{ rewards: { xp: number; coins: number } }>('SELECT rewards FROM quests WHERE id=$1', ['q_station_arrival']);
    assert.deepEqual(((await (await call('/me')).json()) as { stats: unknown }).stats,
      { xp: 23 + earned.rows[0]!.rewards.xp, coins: 100 + earned.rows[0]!.rewards.coins });
    for (const path of ['/me', '/characters']) {
      const response = await fetch(base + path, { method: path === '/me' ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json' }, ...(path === '/me' ? {} : { body: JSON.stringify(request) }) });
      assert.equal(response.status, 401);
    }
  } finally {
    if (userId) await database.query('DELETE FROM auth.users WHERE id = $1', [userId]);
    await app.close();
    await database.end();
  }
});

// A zero-balance newcomer must get exactly $500 and duplicate creation must not top up.
test('T15 new character starts with $500 and reload retains it', async () => {
  const url = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.port, '55422');
  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const database = new Pool({ connectionString: process.env.DATABASE_URL });
  const userId = randomUUID();
  try {
    await database.query('INSERT INTO auth.users (id,email,raw_user_meta_data) VALUES ($1,$2,$3)',
      [userId, `t15-${userId}@example.com`, {}]);
    const options = await module.get(OnboardingService).getOptions();
    const request = { name: 'Wallet Learner', cityId: options.cities[0]!.id, avatarId: options.avatars[0]!.id };
    const players = module.get(PlayersService);
    assert.deepEqual((await players.createCharacter(userId, request)).stats, { xp: 0, coins: 500 });
    assert.deepEqual((await players.getPlayer(userId)).stats, { xp: 0, coins: 500 });
    await assert.rejects(players.createCharacter(userId, request), /already exists/);
    assert.deepEqual((await players.getPlayer(userId)).stats, { xp: 0, coins: 500 });
  } finally {
    await database.query('DELETE FROM auth.users WHERE id=$1', [userId]);
    await database.end();
    await module.close();
  }
});
