import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { createClient } from '@supabase/supabase-js';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { AppModule } from '../app.module';
import { DatabaseService } from '../infrastructure/database/database.service';
import { ConversationsService } from '../modules/conversations/conversations.service';
import { LearningService } from '../modules/learning/learning.service';

// Uses the existing account and real persistence, with all game changes rolled
// back. No HTTP listener, new user, or permanent clock/wallet change.
test('T12 coffee order persists one useful phrase and a Coach correction, scoped to its owner', async () => {
  const databaseUrl = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(databaseUrl.hostname, '127.0.0.1');
  assert.ok(['54322', '55422'].includes(databaseUrl.port));
  const authUrl = process.env.SUPABASE_URL ?? '';
  assert.equal(new URL(authUrl).hostname, '127.0.0.1');
  const auth = createClient(authUrl, process.env.SUPABASE_PUBLISHABLE_KEY ?? '', {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const login = await auth.auth.signInWithPassword({ email: process.env.T12_TEST_EMAIL ?? 'test@gmail.com',
    password: process.env.T12_TEST_PASSWORD ?? process.env.T17_TEST_PASSWORD ?? '' });
  assert.equal(login.error, null, 'Existing test account must sign in');
  const userId = login.data.user!.id;
  const pool = new Pool({ connectionString: databaseUrl.toString() });
  const client = await pool.connect();
  const database = {
    query: <Row extends QueryResultRow>(sql: string, values: unknown[] = []) => client.query<Row>(sql, values),
    transaction: <T>(work: (connection: PoolClient) => Promise<T>) => work(client),
  };
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DatabaseService).useValue(database).compile();
  try {
    await client.query('BEGIN');
    await client.query("UPDATE player_life SET clock_time='2000-01-01T09:00:00Z',clock_anchor=now() WHERE user_id=$1", [userId]);
    await client.query('UPDATE player_stats SET energy=100,coins=500 WHERE user_id=$1', [userId]);
    const conversations = module.get(ConversationsService);
    const conversation = await conversations.create(userId, 'npc_mia');
    const send = (text: string, coach = false) => conversations.send(userId, conversation.id,
      { clientMessageId: randomUUID(), text, coach });
    const corrected = await send('I want buy an espresso', true);
    assert.equal(corrected.intent, 'order');
    assert.equal(corrected.correction?.improved, 'I want to buy an espresso.');
    assert.equal((await send("I'd like an espresso, please.")).intent, 'order');
    const confirm = { clientMessageId: randomUUID(), text: 'Yes, please', coach: false };
    assert.equal((await conversations.send(userId, conversation.id, confirm)).intent, 'paid');
    const learning = module.get(LearningService);
    const review = await learning.review(userId);
    assert.ok(review.phrases.some(entry => entry.phrase === "I'd like…" && entry.example === "I'd like an espresso, please."));
    assert.ok(review.corrections.some(entry => entry.id === corrected.npcMessage.id && entry.feedback.original === 'I want buy an espresso'));
    await conversations.send(userId, conversation.id, confirm);
    assert.deepEqual(await learning.review(userId), review, 'Replayed messages must not duplicate learning history');
    assert.deepEqual(await learning.review(randomUUID()), { phrases: [], corrections: [] }, 'Another owner must not see these entries');
  } finally {
    await client.query('ROLLBACK'); client.release(); await pool.end(); await module.close();
  }
});
