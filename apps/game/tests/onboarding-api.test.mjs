/* global AbortSignal */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = await readFile(new URL('../src/api/client.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source.replaceAll('import.meta.env', 'testEnv'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const require = createRequire(import.meta.url);

function loadClient(fetch) {
  const module = { exports: {} };
  runInNewContext(code, { module, exports: module.exports, require, fetch,
    testEnv: { VITE_API_URL: 'http://fixture/api/v1' }, navigator: { onLine: true }, AbortSignal });
  return module.exports;
}

// Omitting the session token makes the real protected R3 endpoint return 401.
test('onboarding options use the current session token and validate the API catalog', async () => {
  const catalog = { countries: [{ id: 'country_sweden', name: 'Sweden', isoCode: 'SE', flag: '🇸🇪', timeZone: 'Europe/Stockholm' }],
    avatars: [{ id: 'avatar_fixture', label: 'Fixture Look', outfitColor: '#527b78' }] };
  const client = loadClient(async (url, init) => {
    assert.equal(url, 'http://fixture/api/v1/onboarding/options');
    assert.equal(init.method, 'GET');
    assert.equal(init.headers.Authorization, 'Bearer current-token');
    return { ok: true, status: 200, json: async () => catalog };
  });
  assert.deepEqual(JSON.parse(JSON.stringify(await client.loadOptions('current-token'))), catalog);
});

test('onboarding options reject a malformed successful response', async () => {
  const client = loadClient(async () => ({ ok: true, status: 200, json: async () => ({ countries: [], avatars: 'invalid' }) }));
  await assert.rejects(client.loadOptions('current-token'), /Invalid onboarding catalog/);
});
// The authenticated exit must use the protected endpoint and never cache private state.
test('arrival exit sends an authenticated, network-only request and validates saved state', async () => {
  const arrival = { questId: 'q_station_arrival', status: 'done', currentStepId: null,
    ticket: { issued: true, used: true }, canEnterTownStreet: true,
    locationId: 'loc_town_street', rewardsGranted: true };
  const client = loadClient(async (url, init) => {
    assert.equal(url, 'http://fixture/api/v1/quests/arrival/enter-town-street');
    assert.equal(init.method, 'POST');
    assert.equal(init.headers.Authorization, 'Bearer current-token');
    assert.equal(init.cache, 'no-store');
    assert.equal(init.body, '{}');
    return { ok: true, status: 200, json: async () => arrival };
  });
  assert.equal(typeof client.enterTownStreet, 'function', 'authenticated arrival exit is missing');
  assert.deepEqual(await client.enterTownStreet('current-token'), arrival);
});
