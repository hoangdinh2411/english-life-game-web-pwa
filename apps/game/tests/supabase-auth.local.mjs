/* global AbortSignal */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { randomUUID } from 'node:crypto';
import ts from 'typescript';
const require = createRequire(new URL('../package.json', import.meta.url));
const serverRequire = createRequire(new URL('../../server/package.json', import.meta.url));
const settings = Object.fromEntries(readFileSync(new URL('../../server/.env.supabase.local', import.meta.url), 'utf8').split(/\r?\n/).filter((line) => /^[A-Z_]+=/.test(line)).map((line) => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1)]; }));
assert.equal(new URL(settings.SUPABASE_URL).hostname, '127.0.0.1');
assert.equal(new URL(settings.DATABASE_URL).hostname, '127.0.0.1');
const module = { exports: {} };
const code = ts.transpileModule(readFileSync(new URL('../src/api/supabase-auth.ts', import.meta.url), 'utf8').replaceAll('import.meta.env', 'testEnv'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
runInNewContext(code, { module, exports: module.exports, require, fetch, AbortSignal, testEnv: { VITE_SUPABASE_URL: settings.SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY: settings.SUPABASE_PUBLISHABLE_KEY } });
const auth = module.exports;
const email = `p1-${randomUUID()}@example.com`;
const password = randomUUID();
const { Client } = serverRequire('pg');
const database = new Client({ connectionString: settings.DATABASE_URL });
await database.connect();
try {
  const signed = await auth.register(email, password, 'P1 disposable verification');
  assert.ok(signed.token, 'local confirmation-disabled signup returns session');
  assert.equal((await database.query('select display_name from profiles where id = $1', [signed.user.id])).rows[0].display_name, 'P1 disposable verification');
  const logged = await auth.login(email, password);
  assert.equal(logged.user.id, signed.user.id);
  const refreshed = await auth.refreshSession(logged.refreshToken);
  assert.notEqual(refreshed.refreshToken, logged.refreshToken);
  await auth.logout(refreshed.token);
  await assert.rejects(auth.refreshSession(refreshed.refreshToken));
  console.log('PASS: real local Auth signup/profile metadata, login, refresh rotation, logout and revoked-refresh rejection.');
} finally {
  const deleted = await database.query('delete from auth.users where email = $1 returning id', [email]);
  assert.equal(deleted.rowCount, 1);
  console.log('Disposable Auth account removed; existing accounts preserved.');
  await database.end();
}
