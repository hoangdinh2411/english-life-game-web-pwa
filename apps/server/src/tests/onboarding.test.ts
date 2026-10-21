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
test('NPC-02 returns authored country and avatar options without exposing the starter city', async () => {
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
    const countries = JSON.parse(await readFile(resolve(__dirname, '../../../../content/seed/countries.json'), 'utf8')) as Array<Record<string, unknown>>;
    const avatars: unknown = JSON.parse(await readFile(resolve(__dirname, '../../../../content/seed/avatars.json'), 'utf8'));
    const body = await response.json() as Record<string, unknown>;
    assert.deepEqual(body, { countries: countries.map(country => ({
      id: country.id, name: country.name, isoCode: country.isoCode, flag: country.flag, timeZone: country.timeZone,
    })), avatars });
    assert.equal(JSON.stringify(body).includes('city_maplewood'), false);
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
    const city = { id: 'city_fixture', name: 'Internal fixture', isStarterCity: true };
    const countries = [{ id: 'country_fixture', name: 'Fixtureland', isoCode: 'FX', flag: '🏳️', timeZone: 'Europe/Stockholm', starterCityId: city.id }];
    const avatars = [{ id: 'avatar_fixture', label: 'Authored look', outfitColor: '#527b78' }];
    for (const content of [null, '{bad json', JSON.stringify({ ...city, isStarterCity: false }), JSON.stringify(city)]) {
      if (content !== null) await writeFile(resolve(directory, 'town.json'), content);
      await writeFile(resolve(directory, 'countries.json'), JSON.stringify(countries));
      await writeFile(resolve(directory, 'avatars.json'), JSON.stringify(content === JSON.stringify(city) ? [] : avatars));
      const response = await fetch(url, { headers });
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { error: { code: 'service_unavailable', message: 'Service unavailable' } });
    }
    await writeFile(resolve(directory, 'town.json'), JSON.stringify(city));
    await writeFile(resolve(directory, 'countries.json'), JSON.stringify(countries));
    await writeFile(resolve(directory, 'avatars.json'), JSON.stringify(avatars));
    const response = await fetch(url, { headers });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { countries: [{ id: 'country_fixture', name: 'Fixtureland', isoCode: 'FX', flag: '🏳️', timeZone: 'Europe/Stockholm' }], avatars });
  } finally { await app.close(); await rm(directory, { recursive: true, force: true }); }
});
