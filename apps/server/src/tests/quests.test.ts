import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ARRIVAL_QUEST_ID, ArrivalState, arrivalStateSchema } from '@life-abroad/shared';
import { AppModule } from '../app.module';
import { SupabaseTokenVerifier } from '../infrastructure/auth/supabase-token-verifier';
import { QuestsService } from '../modules/quests/quests.service';

test('T5 arrival API uses verified identity, validates empty exit requests and exposes no intent writer', async () => {
  const users: string[] = [];
  const state: ArrivalState = { questId: ARRIVAL_QUEST_ID, status: 'not_started', currentStepId: 'arrival_greet',
    ticket: { issued: false, used: false }, canEnterTownStreet: false, locationId: 'loc_station', rewardsGranted: false };
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(SupabaseTokenVerifier).useValue({ verify: async (token: string) => {
      if (token !== 'valid') throw new UnauthorizedException();
      return 'verified-user';
    } })
    .overrideProvider(QuestsService).useValue({
      getArrival: async (userId: string) => { users.push(userId); return state; },
      enterTownStreet: async (userId: string) => { users.push(userId); return state; },
    }).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix('api/v1');
  try {
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl() + '/api/v1/quests/arrival';
    const headers = { Authorization: 'Bearer valid', 'Content-Type': 'application/json' };
    const read = await fetch(base, { headers });
    assert.equal(read.status, 200);
    assert.deepEqual(arrivalStateSchema.parse(await read.json()), state);
    const exit = await fetch(base + '/enter-town-street', { method: 'POST', headers, body: '{}' });
    assert.equal(exit.status, 201);
    assert.deepEqual(await exit.json(), state);
    for (const body of [null, { userId: 'someone-else' }, { ticket: true }, { xp: 999 }, { intent: 'greet' }, { questId: ARRIVAL_QUEST_ID }]) {
      const response = await fetch(base + '/enter-town-street', { method: 'POST', headers, body: JSON.stringify(body) });
      assert.equal(response.status, 400);
    }
    for (const authorization of ['', 'Bearer invalid']) {
      assert.equal((await fetch(base, { headers: { Authorization: authorization } })).status, 401);
      assert.equal((await fetch(base + '/enter-town-street', { method: 'POST', headers: { ...headers, Authorization: authorization }, body: '{}' })).status, 401);
    }
    assert.equal((await fetch(base + '/intent', { method: 'POST', headers, body: '{"intent":"greet"}' })).status, 404);
    assert.deepEqual(users, ['verified-user', 'verified-user']);
  } finally { await app.close(); }
});
