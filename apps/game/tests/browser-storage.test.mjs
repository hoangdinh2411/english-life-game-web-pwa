import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const key = 'life_abroad_session';
const code = ts.transpileModule(readFileSync(new URL('../src/session/storage.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
function storage() {
  const values = new Map();
  return { getItem: (name) => values.get(name) ?? null, setItem: (name, value) => values.set(name, value), removeItem: (name) => values.delete(name) };
}
function load(localStorage, sessionStorage) {
  const module = { exports: {} };
  runInNewContext(code, { module, exports: module.exports, localStorage, sessionStorage });
  return module.exports;
}
test('a closed/reopened app restores only token credentials, then logout clears both storage locations', async () => {
  const durable = storage(), previousTab = storage();
  const client = load(durable, previousTab);
  await client.writeStoredSession({ token: 'access', refreshToken: 'refresh', expiresAt: 2000000000, profile: 'must-not-store' });
  assert.deepEqual(JSON.parse(durable.getItem(key)), { token: 'access', refreshToken: 'refresh', expiresAt: 2000000000 });
  const reopened = load(durable, storage());
  assert.equal((await reopened.readStoredSession()).refreshToken, 'refresh');
  previousTab.setItem(key, 'stale-token');
  await client.clearSessionToken();
  assert.equal(durable.getItem(key), null);
  assert.equal(previousTab.getItem(key), null);
});
test('legacy tab session is promoted once; corrupt sessions do not trap the app', async () => {
  const durable = storage(), previousTab = storage();
  previousTab.setItem(key, JSON.stringify({ token: 'old-access', refreshToken: 'old-refresh' }));
  const client = load(durable, previousTab);
  assert.equal((await client.readStoredSession()).token, 'old-access');
  assert.equal(previousTab.getItem(key), null);
  assert.equal(JSON.parse(durable.getItem(key)).refreshToken, 'old-refresh');
  for (const raw of ['{broken', 'old-opaque-token', '{"token":3}', '{"token":""}', 'null']) {
    durable.setItem(key, raw);
    assert.equal(await client.readStoredSession(), null);
    assert.equal(durable.getItem(key), null);
  }
});
