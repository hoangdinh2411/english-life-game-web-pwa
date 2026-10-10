import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module';
import { SupabaseTokenVerifier } from '../infrastructure/auth/supabase-token-verifier';

// A missing route, hard-coded catalog or leaked town fields breaks this contract.
test('R3 returns authored city and avatar options through the authenticated API', async () => {
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(SupabaseTokenVerifier).useValue({ verify: async () => 'fixture-user' }).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix('api/v1');
  try {
    await app.listen(0, '127.0.0.1');
    const response = await fetch(await app.getUrl() + '/api/v1/onboarding/options', {
      headers: { Authorization: 'Bearer fixture-token' },
    });
    assert.equal(response.status, 200);
    const town = JSON.parse(await readFile(resolve(__dirname, '../../../../content/seed/town.json'), 'utf8')) as { id: string; name: string; description: string };
    const avatars: unknown = JSON.parse(await readFile(resolve(__dirname, '../../../../content/seed/avatars.json'), 'utf8'));
    assert.deepEqual(await response.json(), { cities: [{ id: town.id, name: town.name, description: town.description }], avatars });
  } finally { await app.close(); }
});

test('R3 rejects missing and invalid tokens instead of returning the catalog', async () => {
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(SupabaseTokenVerifier).useValue({ verify: async () => { throw new UnauthorizedException(); } }).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix('api/v1');
  try {
    await app.listen(0, '127.0.0.1');
    for (const headers of [{}, { Authorization: 'Bearer expired' }]) {
      const response = await fetch(await app.getUrl() + '/api/v1/onboarding/options', { headers });
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: { code: 'unauthorized', message: 'Unauthorized' } });
    }
  } finally { await app.close(); }
});

test('R3 fails safely on missing, malformed, nonstarter and empty content and can retry', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'r3-content-'));
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(SupabaseTokenVerifier).useValue({ verify: async () => 'fixture-user' })
    .overrideProvider('ONBOARDING_SEED_DIRECTORY').useValue(directory).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix('api/v1');
  try {
    await app.listen(0, '127.0.0.1');
    const url = await app.getUrl() + '/api/v1/onboarding/options';
    const headers = { Authorization: 'Bearer fixture-token' };
    const city = { id: 'city_fixture', name: 'Authored fixture', isStarterCity: true };
    const avatars = [{ id: 'avatar_fixture', label: 'Authored look', outfitColor: '#527b78' }];
    for (const content of [null, '{bad json', JSON.stringify({ ...city, isStarterCity: false }), JSON.stringify(city)]) {
      if (content !== null) await writeFile(resolve(directory, 'town.json'), content);
      await writeFile(resolve(directory, 'avatars.json'), JSON.stringify(content === JSON.stringify(city) ? [] : avatars));
      const response = await fetch(url, { headers });
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { error: { code: 'service_unavailable', message: 'Service unavailable' } });
    }
    await writeFile(resolve(directory, 'town.json'), JSON.stringify(city));
    await writeFile(resolve(directory, 'avatars.json'), JSON.stringify(avatars));
    const response = await fetch(url, { headers });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { cities: [{ id: city.id, name: city.name }], avatars });
  } finally { await app.close(); await rm(directory, { recursive: true, force: true }); }
});
