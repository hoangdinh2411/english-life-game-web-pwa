/* global Request */
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const dist = new URL('../dist/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', dist), 'utf8'));
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.start_url, '/');
assert.equal(manifest.scope, '/');
for (const size of [192, 512]) assert.ok(manifest.icons.some((icon) => icon.sizes === `${size}x${size}` && icon.purpose === 'any'));
assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'));
for (const icon of manifest.icons) {
  const png = await readFile(new URL(icon.src.replace(/^\//, ''), dist));
  const size = Number(icon.sizes.split('x')[0]);
  assert.equal(png.readUInt32BE(16), size);
  assert.equal(png.readUInt32BE(20), size);
}
// Execute the emitted worker's real install handler, not a duplicate manifest parser.
const handlers = new Map();
let requests = [];
runInNewContext(await readFile(new URL('sw.js', dist), 'utf8'), {
  self: { registration: { scope: 'https://game.fixture/' }, addEventListener: (name, handler) => handlers.set(name, handler) },
  URL, Request, caches: { open: async () => ({ addAll: async (values) => { requests = values; } }) },
});
let install;
handlers.get('install')({ waitUntil: (promise) => { install = promise; } });
await install;
const urls = requests.map((request) => new URL(request.url).pathname.slice(1));
assert.ok(urls.every((path) => !path.includes('game-assets') && !/location_(?:cafe|clothes|maplewood_street)/.test(path)));
assert.equal(new Set(urls).size, urls.length);
assert.ok(urls.includes('index.html'));
assert.ok(urls.includes('manifest.webmanifest'));
let bytes = 0;
for (const path of urls) {
  assert.match(path, /^(?:index\.html|manifest\.webmanifest|icons\/[^/]+\.png|assets\/[^/]+\.(?:js|css|png|mp3))$/);
  bytes += (await stat(new URL(path, dist))).size;
}
assert.ok(urls.some((path) => /create-station-game.*\.js$/.test(path)));
assert.ok(urls.some((path) => /location_station_map_labeled.*\.png$/.test(path)));
assert.equal(urls.filter((path) => path.endsWith('.mp3')).length, 26);
assert.equal(urls.filter((path) => /-portrait-.*\.png$/.test(path)).length, 4);
console.log(`PASS: standalone manifest/icons, ${urls.length} unique public precache files (${(bytes / 1024 / 1024).toFixed(2)} MiB), Phaser/maps/portraits/26 audio clips; all exist.`);
