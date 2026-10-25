import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { createClient } from '@supabase/supabase-js';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { conversationSchema, conversationTurnSchema, shopOrderListSchema } from '@life-abroad/shared';
import { AppModule } from '../app.module';
import { WorldClockService } from '../modules/world-clock/world-clock.service';
import { MutableWorldClock } from './support/mutable-world-clock';
import { AiService } from '../modules/ai/ai.service';
import { DatabaseService } from '../infrastructure/database/database.service';
import { ConversationsRepository } from '../modules/conversations/conversations.repository';
import { ServiceUnavailableException } from '@nestjs/common';

// Catches charges before confirmation, duplicate payment, lost pending orders,
// and successful-looking replies when a transaction actually failed.
test('T17 seller Auth/API: existing account, pending order, pay once, cancel and insufficient funds', async () => {
  const stableTurn = (value: unknown) => {
    const turn = conversationTurnSchema.parse(value);
    return { ...turn, seller: turn.seller ? { shop: turn.seller.shop, pendingOrder: turn.seller.pendingOrder } : undefined,
      npcMessage: { ...turn.npcMessage,
      speech: turn.npcMessage.speech ? { url: new URL(turn.npcMessage.speech.url).pathname } : undefined } };
  };
  const url = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '54322');
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
  const worldClock = new MutableWorldClock();
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DatabaseService).useValue(database)
    .overrideProvider(WorldClockService).useValue(worldClock)
    .overrideProvider(AiService).useValue({ enabled: false }).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix('api/v1');
  let userId: string | undefined;
  try {
    await client.query('BEGIN');
    const signup = await auth.auth.signUp({
      email: `t17-${randomUUID()}@example.com`,
      password: randomUUID(),
    });
    assert.equal(signup.error, null); assert.ok(signup.data.session); assert.ok(signup.data.user);
    userId = signup.data.user.id;
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl() + '/api/v1';
    const headers = { Authorization: `Bearer ${signup.data.session.access_token}`, 'Content-Type': 'application/json' };
    const call = (path: string, body?: unknown) => fetch(base + path, { headers,
      method: body === undefined ? 'GET' : 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const options = await (await call('/onboarding/options')).json() as { countries: { id: string }[] };
    assert.equal((await call('/characters', {
      name: 'T Seventeen Learner', countryId: options.countries[0]!.id, gender: 'male',
    })).status, 201);
    // T17 isolates shop payment from the later café quest reward; all changes roll back.
    await client.query(`UPDATE player_quests SET status='not_started',current_step_id='arrival_greet',
      bus_ticket_issued_at=null,bus_ticket_used_at=null,rewards_granted_at=null
      WHERE user_id=$1 AND quest_id='q_station_arrival'`, [userId]);
    await client.query('UPDATE player_stats SET coins=500,energy=100 WHERE user_id=$1', [userId]);
    await client.query('INSERT INTO player_life (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [userId]);
    const created = await call('/conversations', { npcId: 'npc_mia' });
    assert.equal(created.status, 201, await created.clone().text());
    const conversation = conversationSchema.parse(await created.json());
    assert.match(conversation.messages[0]!.text, /what|welcome|hello|hi|good to see you/i);
    const path = `/conversations/${conversation.id}`;
    const send = (text: string, clientMessageId = randomUUID()) =>
      call(path + '/messages', { text, clientMessageId });
    const turn = async (text: string) => {
      const response = await send(text); assert.equal(response.status, 201);
      const value = conversationTurnSchema.parse(await response.json());
      assert.ok(value.seller);
      return { ...value, seller: value.seller };
    };
    const stats = async () => (await client.query<{ coins: number; energy: number }>(
      'SELECT coins,energy FROM player_stats WHERE user_id=$1', [userId])).rows[0]!;
    assert.equal((await turn('Yes please')).intent, 'ask_menu', 'answer the opening menu question naturally');
    assert.equal((await turn('Hello')).intent, 'greet');
    assert.equal((await turn('How is the weather?')).intent, 'ask_weather');
    assert.equal((await turn('How are you?')).intent, 'ask_wellbeing');
    assert.match((await turn('I feel sick')).npcMessage.text, /sorry|not feeling well/i);
    assert.match((await turn('What do you have?')).npcMessage.text, /menu below/i);
    assert.match((await turn('How much is a cappuccino?')).npcMessage.text, /\$7/);
    assert.equal((await stats()).coins, 500);
    assert.equal((await turn('I would like two cappuccinos please')).seller.pendingOrder?.total, 14);
    const saved = await (await call(path)).json() as { seller: { pendingOrder: { quantity: number } } };
    assert.equal(saved.seller.pendingOrder.quantity, 2);
    const refreshed = await auth.auth.refreshSession();
    assert.equal(refreshed.error, null); assert.ok(refreshed.data.session);
    headers.Authorization = `Bearer ${refreshed.data.session.access_token}`;
    const afterRefresh = await (await call(path)).json() as { seller: unknown };
    assert.deepEqual(afterRefresh.seller, saved.seller);
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
    const pendingCafeOrder = await turn("I don't want an espresso");
    assert.equal(pendingCafeOrder.seller.pendingOrder?.total, 14);
    const cafeOrderId = pendingCafeOrder.seller.pendingOrder!.orderId;
    const ordersBeforePayment = await client.query<{ count: string }>(
      'SELECT count(*) FROM public.shop_orders WHERE user_id=$1 AND idempotency_key=$2', [userId, cafeOrderId]);
    assert.equal(Number(ordersBeforePayment.rows[0]!.count), 0);
    assert.equal((await turn('Yes please')).intent, 'order', 'repeat an unconfirmed order before paying');
    const paidMessageId = randomUUID();
    const paidResponse = await send('Yes please', paidMessageId);
    assert.equal(paidResponse.status, 201);
    const paidTurn = conversationTurnSchema.parse(await paidResponse.json());
    assert.equal(paidTurn.intent, 'paid');
    assert.deepEqual(stableTurn(await (await send('Yes please', paidMessageId)).json()), stableTurn(paidTurn),
      'replayed payment confirmation returns its receipt without creating a second order');
    const orderRow = await client.query<{ id: string; items: unknown; total: number }>(
      'SELECT id,items,total FROM public.shop_orders WHERE user_id=$1 AND idempotency_key=$2', [userId, cafeOrderId]);
    assert.equal(orderRow.rows.length, 1);
    assert.equal(orderRow.rows[0]!.total, 14);
    assert.deepEqual(orderRow.rows[0]!.items, [{ itemId: 'cappuccino', name: 'Cappuccino', quantity: 2, unitPrice: 7 }]);
    await client.query("UPDATE shop_items SET price=9 WHERE id='cappuccino'");
    const historyResponse = await call('/life/orders');
    assert.equal(historyResponse.status, 200, await historyResponse.clone().text());
    const history = shopOrderListSchema.parse(await historyResponse.json());
    const savedOrder = history.find(order => order.id === orderRow.rows[0]!.id);
    assert.ok(savedOrder, 'authenticated order history survives a separate reload request');
    assert.equal(savedOrder.total, 14); assert.equal(savedOrder.items[0]!.unitPrice, 7);
    assert.deepEqual(shopOrderListSchema.parse(await (await call(`/life/orders?userId=${randomUUID()}`)).json()), history,
      'the endpoint scopes results to the authenticated account and ignores forged user IDs');
    await client.query("UPDATE shop_items SET price=7 WHERE id='cappuccino'");
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
    const responses = await Promise.all(Array.from({ length: 4 }, () => send('Yes please', key)));
    let receipt: ReturnType<typeof stableTurn> | undefined;
    for (const response of responses) {
      assert.equal(response.status, 201);
      const value = stableTurn(await response.json()); receipt ??= value; assert.deepEqual(value, receipt);
    }
    assert.equal((await stats()).coins, 486);
    assert.equal((await send('different', key)).status, 409);
    assert.equal((await turn('Yes please')).intent, 'no_order');
    assert.equal((await stats()).coins, 486);
    const failedCafeOrder = await turn('Three smoothies please');
    const failedOrderId = failedCafeOrder.seller.pendingOrder!.orderId;
    await client.query('UPDATE player_stats SET coins=1 WHERE user_id=$1', [userId]);
    assert.equal((await turn('Confirm')).intent, 'insufficient_funds');
    assert.equal((await stats()).coins, 1);
    const failedHistory = await client.query<{ count: string }>(
      'SELECT count(*) FROM public.shop_orders WHERE user_id=$1 AND idempotency_key=$2', [userId, failedOrderId]);
    assert.equal(Number(failedHistory.rows[0]!.count), 0, 'failed payment creates no history entry');
    assert.equal((await turn('Cancel')).seller.pendingOrder, null);
    assert.equal((await turn('Goodbye')).seller.closed, true);
    assert.deepEqual(stableTurn(await (await send('Yes please', key)).json()), receipt);
    assert.equal((await send('An espresso please')).status, 409);
    // T20 clothing orders use the saved seller conversation and charge once.
    // This test's outer transaction restores the existing account afterward.
    await client.query('DELETE FROM owned_shirts WHERE user_id=$1', [userId]);
    await client.query('UPDATE player_stats SET coins=500,energy=100 WHERE user_id=$1', [userId]);
    await client.query("UPDATE player_life SET hair='blond',shirt=NULL,trousers='charcoal' WHERE user_id=$1", [userId]);
    const wardrobeBefore = await (await call('/life')).json() as { coins: number };
    const clothesOpenedResponse = await call('/conversations', { npcId: 'npc_clothes_seller' });
    assert.equal(clothesOpenedResponse.status, 201);
    const clothesOpened = conversationSchema.parse(await clothesOpenedResponse.json());
    assert.equal(clothesOpened.seller?.shop, 'clothes');
    const clothesPath = `/conversations/${clothesOpened.id}`;
    const clothesTurn = async (text: string, clientMessageId = randomUUID()) => {
      const response = await call(`${clothesPath}/messages`, { clientMessageId, text });
      assert.equal(response.status, 201, text);
      return conversationTurnSchema.parse(await response.json());
    };
    assert.match((await clothesTurn('What shirts do you have?')).npcMessage.text,
      /Blue Shirt.*\$30.*Green Shirt.*Red Shirt.*Yellow Shirt/);
    const order = await clothesTurn('I would like a blue shirt, please.');
    assert.equal(order.intent, 'order'); assert.equal(order.seller?.shop, 'clothes');
    assert.equal(order.seller?.pendingOrder?.itemId, 'shirt_blue');
    assert.equal((await (await call('/life')).json() as { coins: number }).coins, wardrobeBefore.coins);
    assert.deepEqual((await (await call(clothesPath)).json() as { seller: unknown }).seller, order.seller);
    const confirmId = randomUUID();
    const purchased = await clothesTurn('Yes please', confirmId);
    assert.equal(purchased.intent, 'paid'); assert.equal(purchased.seller?.pendingOrder, null);
    const excludedClothesOrder = await client.query<{ count: string }>(
      'SELECT count(*) FROM public.shop_orders WHERE user_id=$1 AND idempotency_key=$2',
      [userId, order.seller!.pendingOrder!.orderId]);
    assert.equal(Number(excludedClothesOrder.rows[0]!.count), 0, 'clothes are excluded from café order history');
    assert.deepEqual(stableTurn(await clothesTurn('Yes please', confirmId)), stableTurn(purchased));
    const wardrobeAfterReload = await (await call('/life')).json() as {
      coins: number; appearance: { hair: string; shirt: string | null; trousers: string }; ownedShirts: string[];
    };
    assert.equal(wardrobeAfterReload.coins, wardrobeBefore.coins - 30);
    assert.ok(wardrobeAfterReload.ownedShirts.includes('shirt_blue'));
    assert.deepEqual(wardrobeAfterReload.appearance, { hair: 'blond', shirt: 'blue', trousers: 'charcoal' });
    assert.equal((await client.query<{ quantity: number }>(
      'SELECT quantity FROM owned_shirts WHERE user_id=$1 AND item_id=$2', [userId, 'shirt_blue'])).rows[0]?.quantity, 1);
    const greenOrder = await clothesTurn('I would like a green shirt, please.');
    assert.equal(greenOrder.seller?.pendingOrder?.itemId, 'shirt_green');
    assert.equal((await clothesTurn('Yes please')).intent, 'paid');
    assert.equal((await (await call('/life')).json() as { coins: number }).coins, 440);
    assert.equal((await call('/life/appearance', { key: randomUUID(), shirtItemId: 'shirt_blue' })).status, 201);
    const reEquipped = await (await call('/life')).json() as {
      appearance: { hair: string; shirt: string | null; trousers: string }; ownedShirts: string[];
    };
    assert.deepEqual(reEquipped.appearance, { hair: 'blond', shirt: 'blue', trousers: 'charcoal' });
    assert.ok(reEquipped.ownedShirts.includes('shirt_green'));
    const setStoreTime = async (time: string) => {
      worldClock.setGameTime(`2000-01-01T${time}:00.000Z`);
    };
    for (const [time, expected] of [['07:59', 409], ['08:00', 201], ['13:59', 201], ['14:00', 409]] as const) {
      await setStoreTime(time);
      await client.query('UPDATE player_stats SET coins=500,energy=100 WHERE user_id=$1', [userId]);
      const purchaseKey = randomUUID();
      const response = await call('/life/purchase', { key: purchaseKey, itemIds: ['espresso'] });
      assert.equal(response.status, expected, `store purchase at ${time}`);
      const orderCount: { rows: Array<{ count: string }> } = await client.query<{ count: string }>(
        'SELECT count(*) FROM public.shop_orders WHERE user_id=$1 AND idempotency_key=$2', [userId, purchaseKey]);
      assert.equal(Number(orderCount.rows[0]!.count), expected === 201 ? 1 : 0,
        `direct café purchase history at ${time}`);
      if (expected === 409) assert.match(JSON.stringify(await response.json()), /08:00.*14:00/);
    }
    await setStoreTime('07:59');
    const closedOpening = await call('/conversations', { npcId: 'npc_clothes_seller' });
    assert.equal(closedOpening.status, 409);
    assert.match(JSON.stringify(await closedOpening.json()), /not here right now/i);
    await setStoreTime('10:00');
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
      const body = { clientMessageId: randomUUID(), text: 'How can I leave the station?' };
      const before = await stats();
      const reply = await call(messagePath, body); assert.equal(reply.status, 201);
      const answered = conversationTurnSchema.parse(await reply.json());
      assert.match(answered.npcMessage.text, /receptionist/i);
      assert.equal((await stats()).energy, before.energy - 1);
      assert.equal((await stats()).coins, before.coins);
      assert.deepEqual(stableTurn(await (await call(messagePath, body)).json()), stableTurn(answered));
      assert.equal((await stats()).energy, before.energy - 1);
      const saved = conversationSchema.parse(await (await call(`/conversations/${opened.id}`)).json());
      assert.equal(saved.npcId, npcId); assert.equal(saved.messages.length, 3);
      const orderReply = await call(messagePath, { clientMessageId: randomUUID(), text: npcId.startsWith('npc_clothes_') ? 'What shirts do you have?' : 'Can I order coffee?' });
      assert.equal(orderReply.status, 201);
      const orderText = conversationTurnSchema.parse(await orderReply.json()).npcMessage.text;
      assert.match(orderText, npcId === 'npc_clothes_seller' ? /blue.*green.*red.*yellow/i : /seller|Mia/);
    }
    // Keep the original receptionist API compatible without creating another user.
    const greetings = [];
    for (let index = 0; index < 5; index++) {
      const response = await call('/conversations', { npcId: 'npc_cafe_waiter' });
      assert.equal(response.status, 201);
      const opened = conversationSchema.parse(await response.json());
      greetings.push(opened.messages[0]!.text);
      const saved = conversationSchema.parse(await (await call(`/conversations/${opened.id}`)).json());
      assert.equal(saved.messages.length, 0, 'an unanswered seller opening is not persisted');
    }
    assert.equal(new Set(greetings).size, 5);
    const waiterResponse = await call('/conversations', { npcId: 'npc_cafe_waiter' });
    assert.equal(waiterResponse.status, 201);
    const waiter = conversationSchema.parse(await waiterResponse.json());
    const waiterPath = `/conversations/${waiter.id}/messages`;
    const smallTalk = [
      ['How are you?', 'ask_wellbeing'],
      ['How is the weather?', 'ask_weather'],
      ['I feel tired.', 'feeling_tired'],
      ['I feel fine.', 'feeling_fine'],
      ['I feel sick.', 'health'],
      ['Do you like the station?', 'station'],
      ['Where are you from?', 'ask_origin'],
    ] as const;
    for (const [text, intent] of smallTalk) {
      const response = await call(waiterPath, { clientMessageId: randomUUID(), text });
      assert.equal(response.status, 201, text);
      const turn = conversationTurnSchema.parse(await response.json());
      assert.equal(turn.intent, intent, text);
      assert.equal(turn.misunderstood, false, text);
      assert.notEqual(turn.npcMessage.text, 'Sorry, can you say that again?', text);
    }
    const unknown = await call(waiterPath, {
      clientMessageId: randomUUID(), text: 'purple flying sandwich',
    });
    assert.equal(unknown.status, 201);
    const fallback = conversationTurnSchema.parse(await unknown.json());
    assert.equal(fallback.misunderstood, true);
    assert.equal(fallback.npcMessage.text, 'Sorry, can you say that again?');

    await client.query('UPDATE characters SET current_location_id=$2 WHERE user_id=$1', [userId, 'loc_station']);
    const receptionist = await call('/conversations', { npcId: 'npc_receptionist' });
    assert.equal(receptionist.status, 201);
    const station = conversationSchema.parse(await receptionist.json());
    assert.equal(station.seller, undefined);
    const stationReply = await call(`/conversations/${station.id}/messages`, {
      clientMessageId: randomUUID(), text: 'purple flying sandwich',
    });
    assert.equal(stationReply.status, 201);
    assert.equal(conversationTurnSchema.parse(await stationReply.json()).misunderstood, true);
  } finally {
    await app.close(); await auth.auth.signOut({ scope: 'local' });
    await client.query('ROLLBACK');
    if (userId) await client.query('DELETE FROM auth.users WHERE id=$1', [userId]);
    client.release(); await pool.end();
  }
});
