/* global Response, AbortSignal */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(file, fetch) {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8').replaceAll('import.meta.env', 'testEnv'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  runInNewContext(code, { module, exports: module.exports, fetch, AbortSignal, testEnv: {
    VITE_API_URL: 'http://nest/api/v1', VITE_SUPABASE_URL: 'http://auth.fixture', VITE_SUPABASE_PUBLISHABLE_KEY: 'public-fixture-key',
  }, require });
  return module.exports;
}
const user = { id: 'fixture-user', email: 'learner@example.com', user_metadata: { display_name: 'Learner' } };
const response = () => Response.json({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600, token_type: 'bearer', user });
// Catches credentials being posted to missing Nest auth endpoints instead of Supabase.
test('login uses the real SDK Auth boundary and maps session credentials', async () => {
  const client = load('../src/api/supabase-auth.ts', async (url, init) => {
    assert.equal(String(url), 'http://auth.fixture/auth/v1/token?grant_type=password');
    const body = JSON.parse(init.body); assert.equal(body.email, 'learner@example.com'); assert.equal(body.password, 'password123');
    return response();
  });
  const session = await client.login(' LEARNER@example.com ', 'password123');
  assert.equal(session.token, 'access');
  assert.equal(session.refreshToken, 'refresh');
  assert.equal(session.user.displayName, 'Learner');
  assert.ok(session.expiresAt > Date.now() / 1000);
});


test('signup sends trigger metadata and confirmation-required signup returns no session', async () => {
  const client = load('../src/api/supabase-auth.ts', async (url, init) => {
    assert.equal(String(url), 'http://auth.fixture/auth/v1/signup');
    const body = JSON.parse(init.body);
    assert.equal(body.data.display_name, 'New Learner');
    assert.equal(body.email, 'learner@example.com');
    return Response.json({ ...user, identities: [] });
  });
  const result = await client.register('learner@example.com', 'password123', 'New Learner');
  assert.equal(result.requiresEmailConfirmation, true);
  assert.equal(result.token, undefined);
});

test('immediate signup maps a session and rejects invalid input before Auth calls', async () => {
  let calls = 0;
  const client = load('../src/api/supabase-auth.ts', async () => { calls++; return response(); });
  assert.equal((await client.register('learner@example.com', 'password123', 'Learner')).token, 'access');
  for (const input of [['bad-email', 'password123', 'Learner'], ['learner@example.com', 'short', 'Learner'], ['learner@example.com', 'password123', '   ']]) {
    await assert.rejects(client.register(...input));
  }
  assert.equal(calls, 1);
});

test('refresh rotates credentials through Auth and logout revokes only the current session', async () => {
  const client = load('../src/api/supabase-auth.ts', async (url, init) => {
    if (String(url).includes('/token?grant_type=refresh_token')) {
      assert.equal(JSON.parse(init.body).refresh_token, 'previous-refresh');
      return Response.json({ access_token: 'rotated-access', refresh_token: 'rotated-refresh', expires_in: 3600, token_type: 'bearer', user });
    }
    assert.equal(String(url), 'http://auth.fixture/auth/v1/logout?scope=local');
    assert.equal(init.headers.Authorization, 'Bearer rotated-access');
    return new Response(null, { status: 204 });
  });
  const next = await client.refreshSession('previous-refresh');
  assert.equal(next.token, 'rotated-access');
  assert.equal(next.refreshToken, 'rotated-refresh');
  await client.logout(next.token);
});

test('invalid credentials and revoked refresh propagate Auth status without fake success', async () => {
  const client = load('../src/api/supabase-auth.ts', async () => Response.json({ code: 'invalid_credentials', message: 'Invalid credentials' }, { status: 400 }));
  await assert.rejects(client.login('learner@example.com', 'password123'), (error) => error.status === 400);
  await assert.rejects(client.refreshSession('revoked'), (error) => error.status === 400);
});
