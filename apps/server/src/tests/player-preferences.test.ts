import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { Test } from '@nestjs/testing';
import {
  DEFAULT_PLAYER_PREFERENCES,
  playerPreferencesInitializeSchema,
  playerPreferencesSchema,
  playerPreferencesUpdateSchema,
} from '@life-abroad/shared';
import { AppModule } from '../app.module';
import { DatabaseService } from '../infrastructure/database/database.service';
import { SupabaseTokenVerifier } from '../infrastructure/auth/supabase-token-verifier';
import { PlayersService } from '../modules/players/players.service';

const userId = '11111111-1111-4111-8111-111111111111';
const stored = { ...DEFAULT_PLAYER_PREFERENCES, updatedAt: '2026-10-22T08:00:00.000Z' };

test('preference contracts accept defaults and bounded partial updates', () => {
  assert.deepEqual(playerPreferencesInitializeSchema.parse(DEFAULT_PLAYER_PREFERENCES), DEFAULT_PLAYER_PREFERENCES);
  assert.deepEqual(playerPreferencesSchema.parse(stored), stored);
  for (const update of [{ speechRate: 0.75 }, { speechRate: 1.5 }, { speechPitch: 0.75 }, { speechPitch: 1.25 }]) {
    assert.deepEqual(playerPreferencesUpdateSchema.parse(update), update);
  }
});

test('preference contracts reject empty, unknown, mistyped, non-finite and out-of-range values', () => {
  for (const value of [
    {}, { soundEnabled: false },
    { speechRate: Number.NaN }, { speechRate: Number.POSITIVE_INFINITY },
    { speechRate: 0.749 }, { speechRate: 1.501 },
    { speechPitch: 0.749 }, { speechPitch: 1.251 },
  ]) assert.equal(playerPreferencesUpdateSchema.safeParse(value).success, false);
});

test('authenticated preference routes distinguish missing state, initialization and partial updates', async () => {
  const calls: Array<{ operation: string; userId: string; body?: unknown }> = [];
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(SupabaseTokenVerifier).useValue({ verify: async () => userId })
    .overrideProvider(DatabaseService).useValue({ query: async () => ({ rows: [] }) })
    .overrideProvider(PlayersService).useValue({
      getPreferences: async (id: string) => { calls.push({ operation: 'read', userId: id }); return { preferences: null }; },
      initializePreferences: async (id: string, body: unknown) => { calls.push({ operation: 'initialize', userId: id, body }); return stored; },
      updatePreferences: async (id: string, body: unknown) => { calls.push({ operation: 'update', userId: id, body }); return { ...stored, speechRate: 1.2 }; },
    }).compile();
  const app = module.createNestApplication(); app.setGlobalPrefix('api/v1');
  try {
    await app.listen(0, '127.0.0.1');
    const headers = { Authorization: 'Bearer fixture', 'Content-Type': 'application/json' };
    const read = await fetch(`${await app.getUrl()}/api/v1/players/preferences`, { headers });
    assert.equal(read.status, 200); assert.deepEqual(await read.json(), { preferences: null });
    const initialize = await fetch(`${await app.getUrl()}/api/v1/players/preferences/initialize`, {
      method: 'POST', headers, body: JSON.stringify(DEFAULT_PLAYER_PREFERENCES),
    });
    assert.equal(initialize.status, 201); assert.deepEqual(await initialize.json(), stored);
    const update = await fetch(`${await app.getUrl()}/api/v1/players/preferences`, {
      method: 'POST', headers, body: JSON.stringify({ speechRate: 1.2 }),
    });
    assert.equal(update.status, 201);
    assert.equal(playerPreferencesSchema.parse(await update.json()).speechRate, 1.2);
    assert.deepEqual(calls, [
      { operation: 'read', userId },
      { operation: 'initialize', userId, body: DEFAULT_PLAYER_PREFERENCES },
      { operation: 'update', userId, body: { speechRate: 1.2 } },
    ]);
    for (const body of [{}, { soundEnabled: false }, { speechRate: 2 }]) {
      const invalid = await fetch(`${await app.getUrl()}/api/v1/players/preferences`, {
        method: 'POST', headers, body: JSON.stringify(body),
      });
      assert.equal(invalid.status, 400);
    }
  } finally { await app.close(); }
});

test('preference routes reject unauthenticated requests before persistence', async () => {
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(SupabaseTokenVerifier).useValue({ verify: async () => { throw new Error('invalid token'); } })
    .overrideProvider(DatabaseService).useValue({ query: async () => { throw new Error('Database must not be reached'); } }).compile();
  const app = module.createNestApplication(); app.setGlobalPrefix('api/v1');
  try {
    await app.listen(0, '127.0.0.1');
    for (const request of [
      fetch(`${await app.getUrl()}/api/v1/players/preferences`),
      fetch(`${await app.getUrl()}/api/v1/players/preferences`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"speechRate":1.2}' }),
    ]) assert.equal((await request).status, 401);
  } finally { await app.close(); }
});
