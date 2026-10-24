import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module';
import { SupabaseTokenVerifier } from '../infrastructure/auth/supabase-token-verifier';
import { DatabaseService } from '../infrastructure/database/database.service';

async function countryRows() {
  const countries = JSON.parse(await readFile(resolve(__dirname, '../../../../apps/game/assets/flags/countries.json'), 'utf8')) as Array<Record<string, unknown>>;
  return countries.map(country => ({
    id: country.id,
    name: country.name,
    iso_code: country.iso,
    time_zone: country.timeZone,
    starter_city_id: 'city_maplewood',
  }));
}

// A missing route, hard-coded catalog or leaked town fields breaks this contract.
test('NPC-02 returns authored country options without exposing the starter city', async () => {
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(SupabaseTokenVerifier).useValue({ verify: async () => 'fixture-user' })
    .overrideProvider(DatabaseService).useValue({ query: async () => ({ rows: await countryRows() }) }).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix('api/v1');
  try {
    await app.listen(0, '127.0.0.1');
    const response = await fetch(await app.getUrl() + '/api/v1/onboarding/options', {
      headers: { Authorization: 'Bearer fixture-token' },
    });
    assert.equal(response.status, 200);
    const countries = JSON.parse(await readFile(resolve(__dirname, '../../../../apps/game/assets/flags/countries.json'), 'utf8')) as Array<Record<string, unknown>>;
    const body = await response.json() as Record<string, unknown>;
    assert.deepEqual(body, { countries: countries.map(country => ({
      id: country.id, name: country.name, isoCode: country.iso, flag: country.flag, timeZone: country.timeZone,
    })) });
    assert.equal(JSON.stringify(body).includes('city_maplewood'), false);
  } finally { await app.close(); }
});

test('R3 rejects missing and invalid tokens instead of returning the catalog', async () => {
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(SupabaseTokenVerifier).useValue({ verify: async () => { throw new UnauthorizedException(); } })
    .overrideProvider(DatabaseService).useValue({ query: async () => ({ rows: [] }) }).compile();
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

test('R3 fails safely on an empty database catalog and can retry', async () => {
  let rows: Array<Record<string, unknown>> = [];
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(SupabaseTokenVerifier).useValue({ verify: async () => 'fixture-user' })
    .overrideProvider(DatabaseService).useValue({ query: async () => ({ rows }) })
    .compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix('api/v1');
  try {
    await app.listen(0, '127.0.0.1');
    const url = await app.getUrl() + '/api/v1/onboarding/options';
    const headers = { Authorization: 'Bearer fixture-token' };
    const unavailable = await fetch(url, { headers });
    assert.equal(unavailable.status, 503);
    assert.deepEqual(await unavailable.json(), { error: { code: 'service_unavailable', message: 'Service unavailable' } });
    rows = [{ id: 'country_fixture', name: 'Fixtureland', iso_code: 'FX', time_zone: 'Europe/Stockholm', starter_city_id: 'city_fixture' }];
    const response = await fetch(url, { headers });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { countries: [{ id: 'country_fixture', name: 'Fixtureland', isoCode: 'FX', flag: '🇫🇽', timeZone: 'Europe/Stockholm' }] });
  } finally { await app.close(); }
});
