/* global self, caches, URL, Request, fetch */
// Build-time injection contains only the public files selected in vite.config.ts.
const manifest = self.__WB_MANIFEST;
const signature = JSON.stringify(manifest);
let hash = 2166136261;
for (const character of signature) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
const prefix = 'life-abroad-public-';
const cacheName = `${prefix}${hash.toString(16)}`;
const publicUrls = [...new Set(manifest.map((entry) => new URL(entry.url, self.registration.scope).href))];
const publicPaths = new Set(publicUrls);
const shell = new URL('index.html', self.registration.scope).href;
const routes = new Set(['/', '/sign-in', '/home', '/practice', '/new-game', '/new-game/country', '/new-game/avatar', '/new-game/name', '/new-game/review']);

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    // addAll is atomic: a failed download leaves the existing worker usable.
    await cache.addAll(publicUrls.map((url) => new Request(url, { cache: 'reload', credentials: 'omit' })));
  })());
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith(prefix) && name !== cacheName) await caches.delete(name);
    await self.clients.claim();
  })());
});
self.addEventListener('message', (event) => {
  // Never interrupt an active game automatically. The UI requests activation.
  if (event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
});
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  // No runtime writes: API, Auth, queries and private data stay network-only.
  const navigation = request.mode === 'navigate' && routes.has(url.pathname.replace(/\/$/, '') || '/');
  if (!navigation && !publicPaths.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(navigation ? shell : url.href);
    return cached ?? fetch(request);
  })());
});
