import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { createClient } from '@supabase/supabase-js';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { conversationSchema, conversationTurnSchema } from '@life-abroad/shared';
import { AppModule } from '../app.module';
import { DatabaseService } from '../infrastructure/database/database.service';
import { ConversationsRepository } from '../modules/conversations/conversations.repository';
import { ServiceUnavailableException } from '@nestjs/common';

// Catches charges before confirmation, duplicate payment, lost pending orders,
// and successful-looking replies when a transaction actually failed.
test('T17 seller Auth/API: existing account, pending order, pay once, cancel, insufficient funds and Coach', async () => {
  const url = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(url.hostname, '127.0.0.1'); assert.ok(['54322', '55422'].includes(url.port));
  const authUrl = process.env.SUPABASE_URL ?? '';
  assert.equal(new URL(authUrl).hostname, '127.0.0.1');
  const pool = new Pool({ connectionString: url.toString() });
  const client = await pool.connect();
  const auth = createClient(authUrl, process.env.SUPABASE_PUBLISHABLE_KEY ?? '', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  // Serialize real transactions inside one rollback-only test transaction.
  let queue: Promise<unknown> = Promise.resolve();
  const database = {
    query: <Row extends QueryResultRow>(sql: string, values: unknown[] = []) => client.query<Row>(sql, values),
    transaction: <T>(work: (connection: PoolClient) => Promise<T>): Promise<T> => {
      const result = queue.then(async () => {
        await client.query('SAVEPOINT api_request');
        try { const value = await work(client); await client.query('RELEASE SAVEPOINT api_request'); return value; }
        catch (error: unknown) { await client.query('ROLLBACK TO SAVEPOINT api_request'); throw error; }
      });
      queue = result.catch(() => undefined);
      return result;
    },
  };
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DatabaseService).useValue(database).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix('api/v1');
  try {
    await client.query('BEGIN');
    const login = await auth.auth.signInWithPassword({
      email: process.env.T17_TEST_EMAIL ?? 'test@gmail.com',
      password: process.env.T17_TEST_PASSWORD ?? '',
    });
    assert.equal(login.error, null); assert.ok(login.data.session);
    const userId = login.data.session.user.id;
    await client.query('UPDATE player_stats SET coins=500,energy=100 WHERE user_id=$1', [userId]);
    await client.query(`INSERT INTO player_life (user_id,clock_time,clock_anchor)
      VALUES ($1,'2026-10-11T10:00:00Z',now()) ON CONFLICT (user_id)
      DO UPDATE SET clock_time=excluded.clock_time,clock_anchor=excluded.clock_anchor`, [userId]);
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl() + '/api/v1';
    const headers = { Authorization: `Bearer ${login.data.session.access_token}`, 'Content-Type': 'application/json' };
    const call = (path: string, body?: unknown) => fetch(base + path, { headers,
      method: body === undefined ? 'GET' : 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const created = await call('/conversations', { npcId: 'npc_mia' });
    assert.equal(created.status, 201, 'seller conversations must be supported');
    const conversation = conversationSchema.parse(await created.json());
    assert.match(conversation.messages[0]!.text, /what|welcome|hello|hi/i);
    const path = `/conversations/${conversation.id}`;
    const send = (text: string, coach = false, clientMessageId = randomUUID()) =>
      call(path + '/messages', { text, coach, clientMessageId });
    const turn = async (text: string, coach = false) => {
      const response = await send(text, coach); assert.equal(response.status, 201);
      const value = conversationTurnSchema.parse(await response.json());
      assert.ok(value.seller);
      return { ...value, seller: value.seller };
    };
    const stats = async () => (await client.query<{ coins: number; energy: number }>(
      'SELECT coins,energy FROM player_stats WHERE user_id=$1', [userId])).rows[0]!;
    assert.equal((await turn('Yes please')).intent, 'ask_menu', 'answer the opening menu question naturally');
    assert.equal((await turn('Hello')).intent, 'greet');
    assert.equal((await turn('How is the weather?')).intent, 'weather');
    assert.equal((await turn('How are you?')).intent, 'wellbeing');
    assert.match((await turn('I feel sick')).npcMessage.text, /sorry|not feeling well/i);
    assert.match((await turn('What do you have?')).npcMessage.text, /Espresso.*\$5/);
    assert.match((await turn('How much is a cappuccino?')).npcMessage.text, /\$7/);
    assert.equal((await turn('I want buy coffee', true)).correction?.improved, 'I want to buy coffee.');
    assert.equal((await stats()).coins, 500);
    assert.equal((await turn('I would like two cappuccinos please')).seller.pendingOrder?.total, 14);
    const saved = await (await call(path)).json() as { seller: { pendingOrder: { quantity: number } } };
    assert.equal(saved.seller.pendingOrder.quantity, 2);
    const refreshed = await auth.auth.refreshSession();
    assert.equal(refreshed.error, null); assert.ok(refreshed.data.session);
    headers.Authorization = `Bearer ${refreshed.data.session.access_token}`;
    assert.deepEqual(await (await call(path)).json(), saved);
    assert.equal((await turn('Make that three cappuccinos')).seller.pendingOrder?.total, 21);
    assert.equal((await turn('Cancel my order')).seller.pendingOrder, null);
    assert.equal((await turn('Yes')).intent, 'no_order');
    assert.equal((await stats()).coins, 500);
    assert.equal((await turn('I want four cappuccinos')).intent, 'invalid_quantity');
    assert.equal((await turn('I want -1 espresso')).intent, 'invalid_quantity');
    assert.equal((await turn('I want an espresso and a pizza')).intent, 'one_item');
    assert.equal((await turn('I want a pizza')).intent, 'unknown_item');
    await turn('Two cappuccinos please');
    // A price question and a negated order must not replace or pay the order.
    await turn('How much is an espresso?');
    assert.equal((await turn('Yes please')).intent, 'order', 'repeat the pending order after a price question before accepting payment');
    assert.equal((await stats()).coins, 500);
    assert.equal((await turn("I don't want an espresso")).seller.pendingOrder?.total, 14);
    await turn('Yes please');
    const before = await stats();
    const repository = app.get(ConversationsRepository);
    const append = repository.append.bind(repository);
    repository.append = async (...args) => {
      if (args[2] === 'npc') throw new ServiceUnavailableException('Injected failure');
      return append(...args);
    };
    try { assert.equal((await send('Yes please')).status, 503); }
    finally { repository.append = append; }
    assert.deepEqual(await stats(), before);
    const key = randomUUID();
    const responses = await Promise.all(Array.from({ length: 4 }, () => send('Yes please', false, key)));
    let receipt: unknown;
    for (const response of responses) {
      assert.equal(response.status, 201);
      const value: unknown = await response.json(); receipt ??= value; assert.deepEqual(value, receipt);
    }
    assert.equal((await stats()).coins, 486);
    assert.equal((await send('different', false, key)).status, 409);
    assert.equal((await turn('Yes please')).intent, 'no_order');
    assert.equal((await stats()).coins, 486);
    await turn('Three smoothies please');
    await client.query('UPDATE player_stats SET coins=1 WHERE user_id=$1', [userId]);
    assert.equal((await turn('Confirm')).intent, 'insufficient_funds');
    assert.equal((await stats()).coins, 1);
    assert.equal((await turn('Cancel')).seller.pendingOrder, null);
    assert.equal((await turn('Goodbye')).seller.closed, true);
    assert.deepEqual(await (await send('Yes please', false, key)).json(), receipt);
    assert.equal((await send('An espresso please')).status, 409);
    // Invalid NPCs/forged order state and unauthenticated calls are rejected.
    assert.equal((await call('/conversations', { npcId: 'npc_missing' })).status, 400);
    assert.equal((await call(path + '/messages', { text: 'yes', clientMessageId: randomUUID(), total: 1 })).status, 400);
    assert.equal((await fetch(base + path)).status, 401);
    const scopes = await client.query<{ scope: string }>('SELECT DISTINCT scope FROM dialogue_nodes');
    assert.deepEqual(scopes.rows.map(row => row.scope), ['npc']);
    // Every rendered companion supports persisted, authenticated, replay-safe dialogue.
    await client.query('UPDATE player_stats SET energy=100 WHERE user_id=$1', [userId]);
    for (const npcId of ['npc_cafe_waiter', 'npc_cafe_customer', 'npc_clothes_seller', 'npc_clothes_assistant', 'npc_clothes_customer']) {
      const response = await call('/conversations', { npcId }); assert.equal(response.status, 201);
      const opened = conversationSchema.parse(await response.json()); assert.equal(opened.npcId, npcId);
      const messagePath = `/conversations/${opened.id}/messages`;
      const body = { clientMessageId: randomUUID(), text: 'How can I leave the station?', coach: false };
      const before = await stats();
      const reply = await call(messagePath, body); assert.equal(reply.status, 201);
      const answered = conversationTurnSchema.parse(await reply.json());
      assert.match(answered.npcMessage.text, /receptionist/i);
      assert.equal((await stats()).energy, before.energy - 1);
      assert.equal((await stats()).coins, before.coins);
      assert.deepEqual(await (await call(messagePath, body)).json(), answered);
      assert.equal((await stats()).energy, before.energy - 1);
      const saved = conversationSchema.parse(await (await call(`/conversations/${opened.id}`)).json());
      assert.equal(saved.npcId, npcId); assert.equal(saved.messages.length, 3);
      const orderReply = await call(messagePath, { clientMessageId: randomUUID(), text: npcId.startsWith('npc_clothes_') ? 'What shirts do you have?' : 'Can I order coffee?', coach: true });
      assert.equal(orderReply.status, 201);
      const orderText = conversationTurnSchema.parse(await orderReply.json()).npcMessage.text;
      assert.match(orderText, npcId === 'npc_clothes_seller' ? /blue.*green.*red.*yellow/ : /seller|Mia/);
    }
    // Keep the original receptionist API compatible without creating another user.
    const greetings = [];
    for (let index = 0; index < 5; index++) {
      const response = await call('/conversations', { npcId: 'npc_cafe_waiter' });
      assert.equal(response.status, 201);
      const opened = conversationSchema.parse(await response.json());
      greetings.push(opened.messages[0]!.text);
      const saved = conversationSchema.parse(await (await call(`/conversations/${opened.id}`)).json());
      assert.equal(saved.messages[0]!.text, opened.messages[0]!.text);
    }
    assert.equal(new Set(greetings).size, 5);
    await client.query('UPDATE characters SET current_location_id=$2 WHERE user_id=$1', [userId, 'loc_station']);
    const receptionist = await call('/conversations', { npcId: 'npc_receptionist' });
    assert.equal(receptionist.status, 201);
    const station = conversationSchema.parse(await receptionist.json());
    assert.equal(station.seller, undefined);
    const stationReply = await call(`/conversations/${station.id}/messages`, {
      clientMessageId: randomUUID(), text: 'purple flying sandwich', coach: false,
    });
    assert.equal(stationReply.status, 201);
    assert.equal(conversationTurnSchema.parse(await stationReply.json()).misunderstood, true);
  } finally {
    await app.close(); await auth.auth.signOut({ scope: 'local' });
    await client.query('ROLLBACK'); client.release(); await pool.end();
  }
});
