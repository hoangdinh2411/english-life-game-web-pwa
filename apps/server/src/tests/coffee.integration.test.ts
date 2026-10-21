import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { Test } from '@nestjs/testing';
import { createClient } from '@supabase/supabase-js';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { AppModule } from '../app.module';
import { DatabaseService } from '../infrastructure/database/database.service';
import { loadSeedContent } from '../infrastructure/content/seed-content';
import { seedContent } from '../infrastructure/content/seed.repository';
import { SupabaseTokenVerifier } from '../infrastructure/auth/supabase-token-verifier';
import { ConversationsService } from '../modules/conversations/conversations.service';
import { ConversationsRepository } from '../modules/conversations/conversations.repository';
import { QuestsService } from '../modules/quests/quests.service';
import { CoffeeQuestService } from '../modules/quests/coffee-quest.service';

test('T18 existing account: prerequisite, drink-only ordered progress, atomic reward, replay, cancellation and persistence', async () => {
  const url = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(url.hostname, '127.0.0.1'); assert.ok(['54322','55422'].includes(url.port));
  const pool = new Pool({ connectionString: url.href });
  const client = await pool.connect();
  const auth = createClient(process.env.SUPABASE_URL ?? '', process.env.SUPABASE_PUBLISHABLE_KEY ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } });
  let queue: Promise<unknown> = Promise.resolve();
  const database = {
    query: <Row extends QueryResultRow>(sql: string, values: unknown[] = []) => client.query<Row>(sql, values),
    transaction: <T>(work: (connection: PoolClient) => Promise<T>): Promise<T> => {
      const result = queue.then(async () => {
        await client.query('SAVEPOINT coffee_request');
        try { const result = await work(client); await client.query('RELEASE SAVEPOINT coffee_request'); return result; }
        catch (error: unknown) { await client.query('ROLLBACK TO SAVEPOINT coffee_request'); throw error; }
      }); queue = result.catch(() => undefined); return result;
    },
  };
  const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(DatabaseService).useValue(database).compile();
  // No HTTP listener or project server is started; all service operations use the real DB and roll back.
  try {
    await client.query('BEGIN');
    const login = await auth.auth.signInWithPassword({ email: 'test@gmail.com', password: process.env.T18_TEST_PASSWORD ?? '' });
    assert.equal(login.error, null); assert.ok(login.data.session);
    const userId = await module.get(SupabaseTokenVerifier).verify(login.data.session.access_token);
    const content = await loadSeedContent(resolve('../../content'));
    await seedContent(client, { ...content, quests: content.quests.filter(quest => quest.id === 'q_order_coffee'), dialogues: [] });
    await client.query("DELETE FROM player_quests WHERE user_id=$1 AND quest_id IN ('q_order_coffee','q_station_arrival')",[userId]);
    await client.query("DELETE FROM quest_reward_claims WHERE user_id=$1 AND quest_id IN ('q_order_coffee','q_station_arrival')",[userId]);
    await client.query("DELETE FROM wallet_ledger WHERE user_id=$1 AND reference IN ('q_order_coffee','q_station_arrival')",[userId]);
    await client.query("UPDATE characters SET current_location_id='loc_station' WHERE user_id=$1",[userId]);
    await client.query('UPDATE player_stats SET coins=500,xp=0,energy=100 WHERE user_id=$1',[userId]);
    await client.query("UPDATE player_life SET clock_time='2026-10-12T10:00:00Z',clock_anchor=now() WHERE user_id=$1",[userId]);
    const conversations = module.get(ConversationsService), quests = module.get(QuestsService), coffee = module.get(CoffeeQuestService);
    const stats = async () => (await client.query<{coins:number;xp:number;energy:number}>('SELECT coins,xp,energy FROM player_stats WHERE user_id=$1',[userId])).rows[0]!;
    assert.equal((await coffee.get(userId)).available, false);
    let session = await conversations.create(userId,'npc_mia');
    const send = (text:string,key=randomUUID()) => conversations.send(userId,session.id,{text,clientMessageId:key});
    assert.equal((await send('Hello')).coffeeQuest?.status,'not_started');
    await quests.applyReceptionistIntent(userId,'npc_receptionist','greet');
    await quests.applyReceptionistIntent(userId,'npc_receptionist','request_bus_ticket');
    await quests.issueArrivalTicket(userId); await quests.enterTownStreet(userId);
    const initial = await stats();
    assert.equal((await send('One espresso please')).coffeeQuest?.status,'not_started');
    await send('Cancel');
    assert.equal((await send('Hello! One espresso please')).coffeeQuest?.currentStepId,'coffee_pay');
    await send('Cancel');
    assert.equal((await send('Hello')).coffeeQuest?.currentStepId,'coffee_order');
    await send('One croissant please'); await send('Confirm');
    assert.equal((await coffee.get(userId)).currentStepId,'coffee_order');
    assert.equal((await stats()).xp,initial.xp);
    assert.equal((await send('One espresso please')).coffeeQuest?.currentStepId,'coffee_pay');
    assert.equal((await send('Cancel')).coffeeQuest?.currentStepId,'coffee_order');
    await send('One espresso please');
    // Asking about prices requires the pending drink order to be repeated, not charged yet.
    await send('How much is espresso?');
    assert.equal((await send('Yes please')).coffeeQuest?.currentStepId,'coffee_pay');
    const balanceBeforeFailure = (await stats()).coins;
    await client.query('UPDATE player_stats SET coins=1 WHERE user_id=$1',[userId]);
    assert.equal((await send('Confirm')).intent,'insufficient_funds');
    assert.equal((await coffee.get(userId)).status,'active');
    assert.equal((await stats()).coins,1); assert.equal((await stats()).xp,initial.xp);
    await client.query('UPDATE player_stats SET coins=$2 WHERE user_id=$1',[userId,balanceBeforeFailure]);
    const before = await stats();
    const repository = module.get(ConversationsRepository), append = repository.append;
    repository.append = async (...args: Parameters<ConversationsRepository['append']>) => {
      if(args[2]==='npc')throw new Error('Injected receipt failure'); return append.apply(repository,args);
    };
    try { await assert.rejects(send('Confirm'),/Injected receipt failure/); } finally { repository.append = append; }
    assert.deepEqual(await stats(),before);
    assert.equal((await coffee.get(userId)).status,'active');
    const key=randomUUID();
    const replies=await Promise.all(Array.from({length:4},()=>send('Confirm',key)));
    assert.ok(replies.every(reply=>reply.coffeeQuest?.status==='done'&&reply.coffeeQuest.rewardsGranted));
    for(const reply of replies)assert.deepEqual(reply,replies[0]);
    const price=Number((await client.query<{price:number}>("SELECT price FROM shop_items WHERE id='cafe_espresso'")).rows[0]?.price ?? (await client.query<{price:number}>("SELECT price FROM shop_items WHERE name='Espresso'")).rows[0]!.price);
    assert.equal((await stats()).coins,before.coins-price+5); assert.equal((await stats()).xp,before.xp+20);
    assert.equal(Number((await client.query<{count:string}>("SELECT count(*) FROM quest_reward_claims WHERE user_id=$1 AND quest_id='q_order_coffee'",[userId])).rows[0]!.count),1);
    assert.equal((await conversations.get(userId,session.id)).coffeeQuest?.status,'done');
    session=await conversations.create(userId,'npc_mia');
    assert.equal(session.coffeeQuest?.status,'done');
    await send('One espresso please'); await send('Confirm');
    assert.equal((await stats()).xp,before.xp+20); assert.equal((await stats()).coins,before.coins-2*price+5);
    assert.match((await send('How can I leave the station?')).npcMessage.text,/receptionist/i);
    const waiter=await conversations.create(userId,'npc_cafe_waiter');
    assert.match((await conversations.send(userId,waiter.id,{text:'Can I order coffee?',clientMessageId:randomUUID()})).npcMessage.text,/Mia/);
    assert.match((await conversations.send(userId,waiter.id,{text:'How can I leave?',clientMessageId:randomUUID()})).npcMessage.text,/receptionist/i);
  } finally {
    await module.close(); await auth.auth.signOut({scope:'local'});
    await client.query('ROLLBACK'); client.release(); await pool.end();
  }
});
