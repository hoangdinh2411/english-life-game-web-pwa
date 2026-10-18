/* global AbortController */
import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchMapPack, packKey, unloadPack } from '../src/features/assets/map-pack.ts';
import { generateAndUpload } from '../../../scripts/generate-map-assets.mjs';
import { readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';

test('offline map entry explains station-only practice without requesting a manifest', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false } });
  try { await assert.rejects(fetchMapPack('loc_town_street', new AbortController().signal), /offline.*station practice/); }
  finally { if (original) Object.defineProperty(globalThis, 'navigator', original); else delete globalThis.navigator; }
});

test('leaving a pack removes its textures, audio, JSON and animations without touching station keys', () => {
  const pack = { mapId: 'loc_town_street', assets: ['map', 'image', 'audio', 'spritesheet', 'json', 'animation'].map((type) => ({ key: type, type, version: 1, npcId: null })) };
  const texture = new Set(['station', 'player']), audio = new Set(), json = new Set(), animations = new Set(), sounds = new Set();
  const caches = { textures: { remove: (key) => texture.delete(key) }, cache: { audio: { remove: (key) => audio.delete(key) }, json: { remove: (key) => json.delete(key) } }, anims: { remove: (key) => animations.delete(key) }, sound: { removeByKey: (key) => sounds.delete(key) } };
  // Ten ownership cycles must return all cache sets to their original size.
  for (let trip = 0; trip < 10; trip++) {
    for (const asset of pack.assets) {
      const key = packKey(pack, asset);
      (asset.type === 'audio' ? audio : ['json', 'animation'].includes(asset.type) ? json : texture).add(key);
      if (asset.type === 'audio') sounds.add(key);
    }
    const animation = `${packKey(pack, pack.assets[3])}-walk`;
    animations.add(animation);
    unloadPack(pack, caches, [animation]);
    assert.deepEqual([...texture], ['station', 'player']);
    for (const cache of [audio, json, animations, sounds]) assert.equal(cache.size, 0);
  }
});

test('uploader sends existing PNG artwork through the asset API', async () => {
  const before = new Set(await readdir(tmpdir()));
  const calls = [];
  const result = await generateAndUpload({ baseUrl: 'http://fixture/api/v1', serviceKey: 'fixture-key', fetcher: async (url, options) => {
    const file = options.body.get('file');
    assert.equal(url, 'http://fixture/api/v1/content/assets/upload');
    assert.equal(options.headers.Authorization, 'Bearer fixture-key');
    assert.equal(options.body.get('mapId'), 'loc_town_street');
    if (file.name.startsWith('portrait-')) assert.match(options.body.get('npcId'), /^npc_/);
    if (file.name.endsWith('.png')) assert.deepEqual([...new Uint8Array(await file.arrayBuffer()).slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    else if (file.name === 'animations.json') assert.equal(JSON.parse(await file.text()).animations.length, 4);
    else if (file.name === 'actors.json') assert.equal(JSON.parse(await file.text()).actors.length, 15);
    else assert.ok(Object.keys(JSON.parse(await file.text()).frames).length >= 17);
    calls.push(file.name);
    return { ok: true, json: async () => ({ url: `http://fixture/${file.name}`, bytes: file.size }) };
  } });
  assert.equal(calls.length, 49);
  assert.ok(calls.includes('street-npcs-1.png'));
  assert.ok(calls.includes('street-npcs-6-atlas.json'));
  assert.equal(result.length, 49);
  const added = (await readdir(tmpdir())).filter((name) => !before.has(name) && name.startsWith('life-abroad-assets-'));
  assert.deepEqual(added, []);
});
