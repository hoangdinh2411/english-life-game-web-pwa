import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import { ServiceUnavailableException } from '@nestjs/common';
import { conversationSchema, conversationTurnSchema, arrivalStateSchema } from '@life-abroad/shared';
import { AppModule } from '../app.module';
import { ConversationsRepository } from '../modules/conversations/conversations.repository';

test('T7 real Auth/API: ordered arrival, append-only messages, replay, rollback and sign-in persistence', async () => {
  const databaseUrl = process.env.DATABASE_URL ?? '';
  const authUrl = process.env.SUPABASE_URL ?? '';
  assert.equal(new URL(databaseUrl).hostname, '127.0.0.1');
  assert.equal(new URL(databaseUrl).port, '55422');
  assert.equal(new URL(authUrl).hostname, '127.0.0.1');
  const database = new Pool({ connectionString: databaseUrl });
  const auth = createClient(authUrl, process.env.SUPABASE_PUBLISHABLE_KEY ?? '', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const email = `t7-${randomUUID()}@example.com`;
  const password = randomUUID();
  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix('api/v1');
  const users: string[] = [];
  try {
    await app.listen(0, '127.0.0.1');
    const signup = await auth.auth.signUp({ email, password });
    assert.equal(signup.error, null);
    assert.ok(signup.data.user && signup.data.session);
    const userId = signup.data.user.id;
    users.push(userId);
    const headers = { Authorization: `Bearer ${signup.data.session.access_token}`, 'Content-Type': 'application/json' };
    const base = await app.getUrl() + '/api/v1';
    const call = (path: string, body?: unknown) => fetch(base + path, {
      headers, method: body === undefined ? 'GET' : 'POST',
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    assert.equal((await call('/conversations', { npcId: 'npc_receptionist' })).status, 409);
    const options = await (await call('/onboarding/options')).json() as { cities: { id: string }[]; avatars: { id: string }[] };
    assert.equal((await call('/characters', { name: 'T7 Learner', cityId: options.cities[0]!.id, avatarId: options.avatars[0]!.id })).status, 201);
    const created = await call('/conversations', { npcId: 'npc_receptionist' });
    assert.equal(created.status, 201);
    const conversation = conversationSchema.parse(await created.json());
    assert.equal(conversation.messages.length, 1);
    assert.equal(conversation.messages[0]!.sender, 'npc');
    assert.equal(conversation.arrival.status, 'not_started');
    const path = `/conversations/${conversation.id}`;
    const send = (text: string, coach = false, clientMessageId = randomUUID()) => call(path + '/messages', { text, coach, clientMessageId });
    assert.equal((await send('Could I have a bus ticket, please?')).status, 409);
    assert.equal(conversationSchema.parse(await (await call(path)).json()).messages.length, 1);
    const misunderstood = conversationTurnSchema.parse(await (await send('purple flying sandwich')).json());
    assert.equal(misunderstood.misunderstood, true);
    assert.equal(misunderstood.intent, null);
    assert.equal(misunderstood.arrival.status, 'not_started');
    const greeting = conversationTurnSchema.parse(await (await send('Hello!')).json());
    assert.equal(greeting.arrival.currentStepId, 'arrival_ask');
    const imperfect = conversationTurnSchema.parse(await (await send('I want get to Maplewood', true)).json());
    assert.equal(imperfect.intent, 'ask_town_directions');
    assert.equal(imperfect.arrival.currentStepId, 'arrival_ticket');
    assert.equal(imperfect.arrival.ticket.issued, false);
    assert.equal(imperfect.correction?.improved, 'I want to get to Maplewood.');
    assert.equal((await send("I don't want a bus ticket")).status, 201);
    assert.equal(arrivalStateSchema.parse(await (await call('/quests/arrival')).json()).ticket.issued, false);

    // Force failure after quest updates and the player INSERT: both must roll back.
    const repository = app.get(ConversationsRepository);
    const append = repository.append.bind(repository);
    const before = await (await call(path)).json();
    repository.append = async (...args) => {
      if (args[2] === 'npc') throw new ServiceUnavailableException('Injected message failure');
      return append(...args);
    };
    try { assert.equal((await send('A bus ticket, please')).status, 503); }
    finally { repository.append = append; }
    assert.deepEqual(await (await call(path)).json(), before);

    const requestId = randomUUID();
    const responses = await Promise.all(Array.from({ length: 6 }, () => send('A bus ticket, please', false, requestId)));
    let issued: ReturnType<typeof conversationTurnSchema.parse> | undefined;
    for (const response of responses) {
      assert.equal(response.status, 201);
      const turn = conversationTurnSchema.parse(await response.json());
      issued ??= turn;
      assert.deepEqual(turn, issued);
    }
    assert.ok(issued);
    assert.deepEqual(issued.arrival.ticket, { issued: true, used: false });
    assert.equal(issued.arrival.canEnterTownStreet, true);
    assert.equal(issued.correction, null);
    assert.match(issued.npcMessage.text, /Here is your bus ticket/);
    assert.equal((await send('different text', false, requestId)).status, 409);
    assert.equal((await send('A bus ticket, please', true, requestId)).status, 409);
    const repeated = conversationTurnSchema.parse(await (await send('Could I have a bus ticket, please?')).json());
    assert.deepEqual(repeated.arrival, issued.arrival);
    const saved = conversationSchema.parse(await (await call(path)).json());
    assert.equal(saved.messages.length, 13);
    const refresh = await auth.auth.refreshSession();
    assert.equal(refresh.error, null);
    assert.ok(refresh.data.session);
    headers.Authorization = `Bearer ${refresh.data.session.access_token}`;
    assert.deepEqual(await (await call(path)).json(), saved);
    await auth.auth.signOut();
    const login = await auth.auth.signInWithPassword({ email, password });
    assert.equal(login.error, null);
    assert.ok(login.data.session);
    headers.Authorization = `Bearer ${login.data.session.access_token}`;
    assert.deepEqual(await (await call(path)).json(), saved);

    // Another real identity cannot read or append to this conversation.
    const other = await auth.auth.signUp({ email: `t7-other-${randomUUID()}@example.com`, password: randomUUID() });
    assert.equal(other.error, null);
    assert.ok(other.data.user && other.data.session);
    users.push(other.data.user.id);
    const ownToken = headers.Authorization;
    headers.Authorization = `Bearer ${other.data.session.access_token}`;
    assert.equal((await call('/characters', { name: 'Other T7', cityId: options.cities[0]!.id, avatarId: options.avatars[0]!.id })).status, 201);
    assert.equal((await call(path)).status, 404);
    assert.equal((await send('Hello')).status, 404);
    headers.Authorization = ownToken;
    assert.deepEqual(await (await call(path)).json(), saved);

    const exits = await Promise.all(Array.from({ length: 4 }, () => call('/quests/arrival/enter-town-street', {})));
    for (const exit of exits) {
      assert.equal(exit.status, 201);
      assert.equal(arrivalStateSchema.parse(await exit.json()).rewardsGranted, true);
    }
    assert.equal((await database.query('SELECT * FROM quest_reward_claims WHERE user_id=$1', [userId])).rowCount, 1);
    assert.deepEqual(await (await send('A bus ticket, please', false, requestId)).json(), issued);
    assert.equal((await send('Hello')).status, 409);
    assert.equal((await call('/conversations', { npcId: 'npc_receptionist' })).status, 409);
    const final = conversationSchema.parse(await (await call(path)).json());
    assert.deepEqual(final.messages, saved.messages);
    assert.equal(final.arrival.status, 'done');
    await assert.rejects(database.query('UPDATE messages SET text=$1 WHERE conversation_id=$2', ['edited', conversation.id]), /append-only/);
    for (const table of ['conversations', 'messages']) {
      const client = await database.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE authenticated');
        await assert.rejects(client.query(`SELECT * FROM public.${table}`), { code: '42501' });
      } finally { await client.query('ROLLBACK'); client.release(); }
    }
  } finally {
    for (const userId of users) await database.query('DELETE FROM auth.users WHERE id=$1', [userId]);
    await app.close();
    await database.end();
  }
});
