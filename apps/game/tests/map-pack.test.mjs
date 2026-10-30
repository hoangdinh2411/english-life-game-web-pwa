/* global AbortController */
import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchMapPack, packKey, unloadPack } from '../src/features/assets/map-pack.ts';

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
