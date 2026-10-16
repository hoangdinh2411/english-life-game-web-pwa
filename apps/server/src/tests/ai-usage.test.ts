import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ConfigService } from '@nestjs/config';
import type { PoolClient, QueryResult } from 'pg';
import { AiUsageService } from '../modules/ai/ai-usage.service';

test('T10e daily chat limits are opt-in and usage increments only for a newly saved AI call', async () => {
  const sql: string[] = [];
  let insertSaved = true;
  const client = { query: async (statement: string): Promise<Partial<QueryResult>> => {
    sql.push(statement);
    if (statement.includes('SELECT tokens_used')) return { rows: [{ tokens_used: 12, free_chats_used: 1 }] };
    if (statement.includes('RETURNING id')) return { rowCount: insertSaved ? 1 : 0, rows: insertSaved ? [{ id: 'usage' }] : [] };
    return { rowCount: 1, rows: [] };
  } } as unknown as PoolClient;
  const usage = new AiUsageService(new ConfigService({ AI_DAILY_CHAT_LIMIT: '1' }));
  assert.equal(await usage.limited(client, 'user'), true);
  await usage.record(client, 'user', 'conversation', 'message', {
    text: 'Hello', provider: 'mock', model: 'mock', inputTokens: 4, outputTokens: 2, fallback: false, usedProvider: true,
  });
  assert.equal(sql.filter(statement => statement.includes('free_chats_used=ai_usage_daily')).length, 1);
  insertSaved = false;
  await usage.record(client, 'user', 'conversation', 'message', {
    text: 'Hello', provider: 'mock', model: 'mock', inputTokens: 4, outputTokens: 2, fallback: false, usedProvider: true,
  });
  assert.equal(sql.filter(statement => statement.includes('free_chats_used=ai_usage_daily')).length, 1);
});

test('T10e invalid configured limits fail startup and absent limits perform no query', async () => {
  assert.throws(() => new AiUsageService(new ConfigService({ AI_DAILY_CHAT_LIMIT: '0' })), /positive integer/);
  const usage = new AiUsageService(new ConfigService());
  let calls = 0;
  const client = { query: async () => { calls++; return { rows: [] }; } } as unknown as PoolClient;
  assert.equal(await usage.limited(client, 'user'), false);
  assert.equal(calls, 0);
});
