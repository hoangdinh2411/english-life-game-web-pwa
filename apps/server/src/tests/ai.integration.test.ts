import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { AppModule } from '../app.module';
import { DatabaseService } from '../infrastructure/database/database.service';
import { SupabaseTokenVerifier } from '../infrastructure/auth/supabase-token-verifier';
import { ConversationsService } from '../modules/conversations/conversations.service';
import { AI_PROVIDER, type AiProvider } from '../modules/ai/ai-provider';
import { GeminiProvider } from '../modules/ai/gemini.provider';
import { MockProvider } from '../modules/ai/mock.provider';

test('T10b resident reply, saved replay and unchanged rewards with existing account (rollback only)', {
  skip: !process.env.T10_TEST_PASSWORD,
}, async () => {
  const url = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.port, '54322');
  const auth = createClient(process.env.SUPABASE_URL ?? '', process.env.SUPABASE_PUBLISHABLE_KEY ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } });
  const login = await auth.auth.signInWithPassword({
    email: 'test@gmail.com', password: process.env.T10_TEST_PASSWORD ?? '',
  });
  assert.equal(login.error, null); assert.ok(login.data.session);
  const pool = new Pool({ connectionString: url.href, connectionTimeoutMillis: 5000 });
  const client = await pool.connect();
  const live = process.env.T10_LIVE_TEST === 'true';
  const adapter = live ? new GeminiProvider(new ConfigService()) : new MockProvider();
  let generated: string | undefined;
  let calls = 0;
  const provider: AiProvider = { reply: async (request, signal) => {
    calls++;
    generated = await adapter.reply(request, signal);
    return generated;
  } };
  const database = {
    query: <Row extends QueryResultRow>(sql: string, values: unknown[] = []) => client.query<Row>(sql, values),
    transaction: <T>(work: (connection: PoolClient) => Promise<T>): Promise<T> => work(client),
  };
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DatabaseService).useValue(database)
    .overrideProvider(AI_PROVIDER).useValue(provider).compile();
  try {
    await client.query('BEGIN');
    const userId = await module.get(SupabaseTokenVerifier).verify(login.data.session.access_token);
    const snapshot = async () => ({
      stats: (await client.query('SELECT xp,coins FROM player_stats WHERE user_id=$1', [userId])).rows,
      quests: (await client.query('SELECT * FROM player_quests WHERE user_id=$1 ORDER BY quest_id', [userId])).rows,
      shirts: (await client.query('SELECT * FROM owned_shirts WHERE user_id=$1 ORDER BY item_id', [userId])).rows,
      wallet: (await client.query('SELECT * FROM wallet_ledger WHERE user_id=$1 ORDER BY id', [userId])).rows,
    });
    const before = await snapshot();
    // Only the temporary test transaction changes energy; everything rolls back.
    await client.query('UPDATE player_stats SET energy=100 WHERE user_id=$1', [userId]);
    const conversations = module.get(ConversationsService);
    const session = await conversations.create(userId, 'npc_mila_florist');
    const request = { text: 'Which season makes you happiest, and why?', clientMessageId: randomUUID(), coach: false };
    const turn = await conversations.send(userId, session.id, request);
    assert.equal(turn.intent, null);
    assert.deepEqual(await conversations.send(userId, session.id, request), turn);
    assert.equal(calls, 1);
    assert.equal((await conversations.get(userId, session.id)).messages.at(-1)?.text, turn.npcMessage.text);
    assert.deepEqual(await snapshot(), before);
    assert.ok(generated, 'A provider reply is required; scripted fallback does not satisfy this test.');
    assert.equal(turn.npcMessage.text, generated);
    console.log(`Verified ${live ? 'Gemini' : 'mock'} NPC reply:`, generated);
  } finally {
    await client.query('ROLLBACK');
    await module.close(); client.release(); await pool.end();
    await auth.auth.signOut({ scope: 'local' });
  }
});
