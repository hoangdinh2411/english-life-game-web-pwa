import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module';
import { DatabaseService } from '../infrastructure/database/database.service';
import { SupabaseTokenVerifier } from '../infrastructure/auth/supabase-token-verifier';
import { UnauthorizedException } from '@nestjs/common';
import { PlayersService } from '../modules/players/players.service';

// A missing player route or hiding signup-created balances breaks account resume.
test('R4 /me returns signup stats before character creation', async () => {
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(SupabaseTokenVerifier).useValue({ verify: async () => '11111111-1111-4111-8111-111111111111' })
    .overrideProvider(DatabaseService).useValue({ query: async () => ({ rows: [{
      id: '11111111-1111-4111-8111-111111111111', email: 'learner@example.com', display_name: 'Learner',
      name: null, current_city_id: null, outfit: null, xp: 23, coins: 7,
    }] }) }).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix('api/v1');
  try {
    await app.listen(0, '127.0.0.1');
    const response = await fetch(await app.getUrl() + '/api/v1/me', { headers: { Authorization: 'Bearer fixture' } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      user: { id: '11111111-1111-4111-8111-111111111111', email: 'learner@example.com', displayName: 'Learner' },
      character: null, stats: { xp: 23, coins: 7 },
    });
  } finally { await app.close(); }
});

test('incomplete legacy characters return to onboarding instead of receiving a default country', async () => {
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(SupabaseTokenVerifier).useValue({ verify: async () => '11111111-1111-4111-8111-111111111111' })
    .overrideProvider(DatabaseService).useValue({ query: async () => ({ rows: [{
      id: '11111111-1111-4111-8111-111111111111', email: 'learner@example.com', display_name: 'Learner',
      name: 'Legacy Learner', current_city_id: null, country_id: null, country_name: null, outfit: {},
      current_map_id: null, current_place_id: null, current_position_x: null, current_position_y: null,
      xp: 23, coins: 7,
    }] }) }).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix('api/v1');
  try {
    await app.listen(0, '127.0.0.1');
    const response = await fetch(await app.getUrl() + '/api/v1/me', { headers: { Authorization: 'Bearer fixture' } });
    assert.equal(response.status, 200);
    assert.equal(((await response.json()) as { character: unknown }).character, null);
  } finally { await app.close(); }
});

// Missing guards would disclose player data or permit unauthenticated creation.
test('R4 player routes reject missing and invalid bearer tokens', async () => {
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(SupabaseTokenVerifier).useValue({ verify: async () => { throw new UnauthorizedException(); } })
    .overrideProvider(DatabaseService).useValue({ query: async () => { throw new Error('Database must not be reached'); } }).compile();
  const app = module.createNestApplication(); app.setGlobalPrefix('api/v1');
  try {
    await app.listen(0, '127.0.0.1');
    for (const path of ['me', 'characters']) for (const headers of [{}, { Authorization: 'Bearer expired' }]) {
      const response = await fetch(await app.getUrl() + '/api/v1/' + path, { method: path === 'me' ? 'GET' : 'POST', headers });
      assert.equal(response.status, 401);
      assert.equal(((await response.json()) as { error: { code: string } }).error.code, 'unauthorized');
    }
  } finally { await app.close(); }
});

// Extra authority fields and malformed names must fail before any database write.
test('ONB-01.2 character validation rejects forged state and malformed names', async () => {
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(SupabaseTokenVerifier).useValue({ verify: async () => '11111111-1111-4111-8111-111111111111' })
    .overrideProvider(DatabaseService).useValue({
      query: async () => ({ rows: [{ id: 'country_fixture', name: 'Fixtureland', iso_code: 'FX',
        time_zone: 'Europe/Stockholm', starter_city_id: 'city_maplewood' }] }),
      transaction: async () => { throw new Error('Unexpected write'); },
    }).compile();
  const app = module.createNestApplication(); app.setGlobalPrefix('api/v1');
  try {
    await app.listen(0, '127.0.0.1');
    for (const body of [{ name: ' ', countryId: 'country_sweden' }, { name: 'A', countryId: 'country_sweden' },
      { name: 'Learner', countryId: 'country_sweden', avatarId: 'avatar_unknown' },
      { name: 'Learner', countryId: 'country_sweden', coins: 999 },
      { name: 'Learner', countryId: 'country_sweden', worldId: 'forged' },
      { name: 'Learner', cityId: 'city_maplewood' }]) {
      const response = await fetch(await app.getUrl() + '/api/v1/characters', { method: 'POST',
        headers: { Authorization: 'Bearer fixture', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      assert.equal(response.status, 400);
      assert.equal(((await response.json()) as { error: { code: string } }).error.code, 'bad_request');
    }
  } finally { await app.close(); }
});

// Missing authorization or pair validation would let a client save an impossible last location.
test('player location route validates and saves the authenticated player location', async () => {
  const writes: Array<{ userId: string; location: unknown }> = [];
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(SupabaseTokenVerifier).useValue({ verify: async () => '11111111-1111-4111-8111-111111111111' })
    .overrideProvider(DatabaseService).useValue({ query: async () => ({ rows: [] }) })
    .overrideProvider(PlayersService).useValue({ saveLocation: async (userId: string, location: unknown) => {
      writes.push({ userId, location });
      return location;
    } }).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix('api/v1');
  try {
    await app.listen(0, '127.0.0.1');
    const response = await fetch(await app.getUrl() + '/api/v1/players/location', {
      method: 'POST', headers: { Authorization: 'Bearer fixture', 'Content-Type': 'application/json' },
      body: JSON.stringify({ mapId: 'loc_station', placeId: 'loc_cafe', x: 700, y: 800 }),
    });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { mapId: 'loc_station', placeId: 'loc_cafe', x: 700, y: 800 });
    assert.deepEqual(writes, [{ userId: '11111111-1111-4111-8111-111111111111', location: { mapId: 'loc_station', placeId: 'loc_cafe', x: 700, y: 800 } }]);

    const invalid = await fetch(await app.getUrl() + '/api/v1/players/location', {
      method: 'POST', headers: { Authorization: 'Bearer fixture', 'Content-Type': 'application/json' },
      body: JSON.stringify({ mapId: 'loc_station', placeId: 'loc_corner_cafe', x: 700, y: 800 }),
    });
    assert.equal(invalid.status, 400);
    assert.equal(writes.length, 1);
  } finally { await app.close(); }
});

