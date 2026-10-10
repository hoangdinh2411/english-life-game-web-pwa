import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AppModule } from '../app.module';
import { SupabaseTokenVerifier } from '../infrastructure/auth/supabase-token-verifier';
import { ConversationsService } from '../modules/conversations/conversations.service';

test('T7 validates typed messages and IDs, rejects forged state and uses verified ownership', async () => {
  const calls: string[] = [];
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(SupabaseTokenVerifier).useValue({ verify: async (token: string) => {
      if (token !== 'valid') throw new UnauthorizedException();
      return 'verified-player';
    } })
    .overrideProvider(ConversationsService).useValue({
      create: async (id: string) => { calls.push(id); return {}; },
      get: async (id: string) => { calls.push(id); return {}; },
      send: async (id: string) => { calls.push(id); return {}; },
    }).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix('api/v1');
  try {
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl() + '/api/v1/conversations';
    const headers = { Authorization: 'Bearer valid', 'Content-Type': 'application/json' };
    const id = randomUUID();
    const request = { clientMessageId: randomUUID(), text: 'Hello' };
    const post = (path: string, body: unknown) => fetch(base + path, { method: 'POST', headers, body: JSON.stringify(body) });
    assert.equal((await post('', { npcId: 'npc_receptionist' })).status, 201);
    assert.equal((await fetch(base + '/' + id, { headers })).status, 200);
    assert.equal((await post(`/${id}/messages`, request)).status, 201);
    for (const body of [null, {}, { npcId: 'npc_mia' }, { npcId: 'npc_receptionist', userId: 'forged' }]) {
      assert.equal((await post('', body)).status, 400);
    }
    for (const body of [null, {}, { ...request, text: ' ' }, { ...request, text: 'a'.repeat(2001) },
      { ...request, clientMessageId: 'invalid' }, { ...request, coach: 'true' },
      { ...request, intent: 'request_bus_ticket' }, { ...request, ticket: true }, { ...request, xp: 999 }]) {
      assert.equal((await post(`/${id}/messages`, body)).status, 400);
    }
    assert.equal((await fetch(base + '/invalid', { headers })).status, 400);
    assert.equal((await post('/invalid/messages', request)).status, 400);
    for (const path of ['', `/${id}`, `/${id}/messages`]) {
      for (const token of ['', 'Bearer invalid']) {
        const response = await fetch(base + path, { method: path === `/${id}` ? 'GET' : 'POST',
          headers: { ...headers, Authorization: token }, ...(path === `/${id}` ? {} : { body: '{}' }) });
        assert.equal(response.status, 401);
      }
    }
    assert.deepEqual(calls, ['verified-player', 'verified-player', 'verified-player']);
  } finally { await app.close(); }
});
