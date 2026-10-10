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
  const catalog = { cities: [{ id: 'city_fixture', name: 'Fixture City' }],
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
  const client = loadClient(async () => ({ ok: true, status: 200, json: async () => ({ cities: [], avatars: 'invalid' }) }));
  await assert.rejects(client.loadOptions('current-token'), /Invalid onboarding catalog/);
});
