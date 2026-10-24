/* global Request, Response */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../src/pwa/sw.js', import.meta.url), 'utf8');
const origin = 'https://game.fixture';
const entries = [{ url: 'index.html', revision: 'shell-v1' }, { url: 'assets/station-a1.png', revision: null }];
function harness(manifest = entries, cacheStorage = new Map(), failInstall = false) {
  const handlers = new Map();
  const network = [];
  let claimed = 0, skipped = 0;
  const caches = {
    keys: async () => [...cacheStorage.keys()],
    delete: async (name) => cacheStorage.delete(name),
    open: async (name) => {
      if (!cacheStorage.has(name)) cacheStorage.set(name, new Map());
      const values = cacheStorage.get(name);
      return {
        addAll: async (requests) => {
          for (const request of requests) { assert.equal(request.credentials, 'omit'); assert.equal(request.cache, 'reload'); }
          if (failInstall) throw new Error('Offline download failed');
          for (const request of requests) values.set(request.url, new Response(request.url.endsWith('index.html') ? 'public-shell' : 'public-art'));
        },
        match: async (url) => values.get(url)?.clone(),
      };
    },
  };
  const self = { __WB_MANIFEST: manifest, registration: { scope: `${origin}/` }, location: { origin },
    clients: { claim: async () => { claimed++; } }, skipWaiting: async () => { skipped++; },
    addEventListener: (name, handler) => handlers.set(name, handler) };
  runInNewContext(source, { self, caches, URL, Request, fetch: async (request) => { network.push(request.url); return new Response('network'); } });
  const lifecycle = (name, data) => {
    let pending = Promise.resolve();
    handlers.get(name)({ data, waitUntil: (promise) => { pending = promise; } });
    return pending;
  };
  const request = (path, { method = 'GET', mode = 'cors' } = {}) => {
    let result;
    handlers.get('fetch')({ request: { url: path.startsWith('http') ? path : origin + path, method, mode }, respondWith: (promise) => { result = promise; } });
    return result;
  };
  return { lifecycle, request, cacheStorage, network, claimed: () => claimed, skipped: () => skipped };
}
test('public shell/immutable media work offline; API, Auth, unknown routes and writes never enter cache handling', async () => {
  const worker = harness();
  await worker.lifecycle('install');
  await worker.lifecycle('activate');
  for (const path of ['/practice', '/home', '/new-game']) assert.equal(await (await worker.request(path, { mode: 'navigate' })).text(), 'public-shell');
  assert.equal(worker.request('/new-game/review', { mode: 'navigate' }), undefined);
  assert.equal(await (await worker.request('/assets/station-a1.png')).text(), 'public-art');
  for (const path of ['/api/v1/me', '/auth/v1/token', '/assets/private.png', '/assets/station-a1.png?token=private',
    '/storage/v1/object/sign/speech-audio/ai/private.mp3?token=private',
    'https://storage.fixture/storage/v1/object/sign/speech-audio/fixed/private.mp3?token=private',
    'https://auth.fixture/auth/v1/token']) {
    assert.equal(worker.request(path), undefined);
    assert.equal(worker.request(path, { mode: 'navigate' }), undefined);
  }
  assert.equal(worker.request('/practice', { method: 'POST', mode: 'navigate' }), undefined);
  assert.equal(worker.network.length, 0);
  assert.equal(worker.claimed(), 1);
  assert.equal(worker.skipped(), 0);
});
test('update waits for an explicit signal and activation cleans only older owned caches', async () => {
  const caches = new Map([['another-application', new Map()]]);
  const first = harness(entries, caches);
  await first.lifecycle('install'); await first.lifecycle('activate');
  const oldName = [...caches.keys()].find((name) => name.startsWith('life-abroad-public-'));
  const next = harness([{ ...entries[0], revision: 'shell-v2' }, entries[1]], caches);
  await next.lifecycle('install');
  assert.ok(caches.has(oldName), 'old version survives while update waits');
  await next.lifecycle('message', { type: 'UNKNOWN' }); assert.equal(next.skipped(), 0);
  await next.lifecycle('message', { type: 'SKIP_WAITING' }); assert.equal(next.skipped(), 1);
  await next.lifecycle('activate');
  assert.equal(caches.has(oldName), false);
  assert.ok(caches.has('another-application'));
  assert.equal(await (await next.request('/practice', { mode: 'navigate' })).text(), 'public-shell');
});
test('failed install leaves the active public cache usable', async () => {
  const first = harness();
  await first.lifecycle('install'); await first.lifecycle('activate');
  const next = harness([{ ...entries[0], revision: 'failed-v2' }], first.cacheStorage, true);
  await assert.rejects(next.lifecycle('install'), /Offline download failed/);
  assert.equal(await (await first.request('/practice', { mode: 'navigate' })).text(), 'public-shell');
  assert.equal(next.claimed(), 0);
});
test('duplicate plugin-generated icon entries are downloaded once', async () => {
  const worker = harness([...entries, entries[0]]);
  await worker.lifecycle('install');
  const values = [...worker.cacheStorage.values()][0];
  assert.equal(values.size, 2);
});
