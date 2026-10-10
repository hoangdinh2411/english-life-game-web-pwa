import assert from 'node:assert/strict';
import test from 'node:test';
import { createSessionManager } from '../src/session/session-manager.ts';

function harness(refresh) {
  const saved = [];
  const changed = [];
  const manager = createSessionManager({ refresh, persist: async (session) => { saved.push(session); },
    clear: async () => { saved.push(null); }, onChange: (session) => changed.push(session), now: () => 100000 });
  return { manager, saved, changed };
}

test('concurrent requests share one refresh and persist rotated credentials', async () => {
  let calls = 0;
  const next = { token: 'new', refreshToken: 'rotated', expiresAt: 500 };
  const { manager, saved } = harness(async (token) => { calls++; assert.equal(token, 'old-refresh'); return next; });
  await manager.set({ token: 'old', refreshToken: 'old-refresh', expiresAt: 100 });
  const responses = await Promise.all([manager.run(async (token) => token), manager.run(async (token) => token)]);
  assert.deepEqual(responses, ['new', 'new']);
  assert.equal(calls, 1);
  assert.deepEqual(saved.at(-1), next);
});

test('401 retries exactly once after refresh', async () => {
  const { manager } = harness(async () => ({ token: 'new', refreshToken: 'next', expiresAt: 500 }));
  await manager.set({ token: 'old', refreshToken: 'refresh', expiresAt: 500 });
  const seen = [];
  const response = await manager.run(async (token) => {
    seen.push(token);
    if (token === 'old') throw Object.assign(new Error('expired'), { status: 401 });
    return 'ok';
  });
  assert.equal(response, 'ok');
  assert.deepEqual(seen, ['old', 'new']);
});

test('legacy sessions work without attempting refresh', async () => {
  const { manager } = harness(async () => { throw new Error('unexpected refresh'); });
  await manager.set({ token: 'legacy' });
  assert.equal(await manager.run(async (token) => token), 'legacy');
});

test('logout during refresh cannot resurrect the previous session', async () => {
  let complete;
  const { manager, saved, changed } = harness(() => new Promise((resolve) => { complete = resolve; }));
  await manager.set({ token: 'old', refreshToken: 'refresh', expiresAt: 100 });
  const request = manager.run(async (token) => token);
  await manager.set(null);
  complete({ token: 'new', refreshToken: 'rotated', expiresAt: 500 });
  await assert.rejects(request, /Please sign in again/);
  assert.equal(manager.get(), null);
  assert.equal(saved.at(-1), null);
  assert.equal(changed.at(-1), null);
});

test('temporary refresh failures preserve stored credentials', async () => {
  const { manager } = harness(async () => { throw new Error('network unavailable'); });
  const session = { token: 'old', refreshToken: 'refresh', expiresAt: 100 };
  await manager.set(session);
  await assert.rejects(manager.run(async () => 'unused'), /network unavailable/);
  assert.deepEqual(manager.get(), session);
});

test('rejected refresh clears an invalid session instead of retrying it forever', async () => {
  const { manager, saved } = harness(async () => { throw Object.assign(new Error('Refresh token revoked'), { status: 400 }); });
  await manager.set({ token: 'expired', refreshToken: 'revoked', expiresAt: 100 });
  await assert.rejects(manager.run(async () => 'unused'), /revoked/);
  assert.equal(manager.get(), null);
  assert.equal(saved.at(-1), null);
});

test('sign out clears credentials before network revocation, even if it fails', async () => {
  const { manager, saved } = harness(async () => { throw new Error('must not refresh'); });
  await manager.set({ token: 'old', refreshToken: 'refresh', expiresAt: 100 });
  await assert.rejects(manager.signOut(async (token) => {
    assert.equal(token, 'old');
    assert.equal(manager.get(), null);
    assert.equal(saved.at(-1), null);
    throw new Error('offline');
  }), /offline/);
  assert.equal(manager.get(), null);
});

test('an obsolete rejected refresh cannot clear a newer login', async () => {
  let reject;
  const { manager } = harness(() => new Promise((_resolve, fail) => { reject = fail; }));
  await manager.set({ token: 'old', refreshToken: 'revoked', expiresAt: 100 });
  const request = manager.run(async () => 'unused');
  await manager.set({ token: 'new-login', refreshToken: 'new-refresh', expiresAt: 500 });
  reject(Object.assign(new Error('revoked'), { status: 400 }));
  await assert.rejects(request, /revoked/);
  assert.equal(manager.get().token, 'new-login');
});
