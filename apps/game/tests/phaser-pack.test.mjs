/* global AbortController */
import assert from 'node:assert/strict';
import test from 'node:test';
import { isDeferredStreetNpcAsset, loadPack, preparePack } from '../src/features/assets/phaser-pack.ts';

// Catches loading the six-character sheet as one giant NPC instead of an atlas.
test('pack loader pairs an NPC image with its atlas JSON', async () => {
  const calls = [], events = new Map();
  const load = {
    on: () => {}, off: () => {}, once: (name, fn) => events.set(name, fn), reset: () => {},
    start: () => events.get('complete')(),
    image: (...args) => calls.push(['image', ...args]),
    atlas: (...args) => calls.push(['atlas', ...args]),
    json: () => {},
  };
  const pack = { mapId: 'loc_cafe', assets: [
    { key: 'shop-npcs', type: 'image', url: 'http://fixture/npcs.png', version: 2, npcId: null },
    { key: 'shop-npcs-atlas', type: 'json', url: 'http://fixture/atlas.json', version: 2, npcId: null },
  ] };
  await loadPack({ load }, pack, () => {}, new AbortController().signal);
  assert.deepEqual(calls, [['atlas', 'pack:loc_cafe:map:shop-npcs:v2', 'http://fixture/npcs.png', 'http://fixture/atlas.json']]);
});

test('Town Street defers resident atlases until their actors are near', async () => {
  const calls = [], events = new Map();
  const load = {
    on: () => {}, off: () => {}, once: (name, fn) => events.set(name, fn), reset: () => {},
    start: () => events.get('complete')(), image: (...args) => calls.push(['image', ...args]),
    atlas: (...args) => calls.push(['atlas', ...args]), json: (...args) => calls.push(['json', ...args]),
    spritesheet: (...args) => calls.push(['spritesheet', ...args]),
  };
  const pack = { mapId: 'loc_town_street', assets: [
    { key: 'background', type: 'map', url: 'http://fixture/map.png', version: 1, npcId: null },
    { key: 'actors', type: 'json', url: 'http://fixture/actors.json', version: 1, npcId: null },
    { key: 'street-npcs-1', type: 'image', url: 'http://fixture/nearby.png', version: 1, npcId: null },
    { key: 'street-npcs-1-atlas', type: 'json', url: 'http://fixture/nearby.json', version: 1, npcId: null },
  ] };
  assert.ok(pack.assets.filter(asset => isDeferredStreetNpcAsset(pack, asset)).every(asset => ['street-npcs-1', 'street-npcs-1-atlas'].includes(asset.key)));
  await loadPack({ load }, pack, () => {}, new AbortController().signal);
  assert.deepEqual(calls, [['image', 'pack:loc_town_street:map:background:v1', 'http://fixture/map.png'], ['json', 'pack:loc_town_street:map:actors:v1', 'http://fixture/actors.json']]);
});

// Catches ignoring uploaded actor placement or displaying a frame from another shop.
test('preparePack resolves authored per-NPC textures and positions', () => {
  const actorIds = ['npc_mia','npc_cafe_waiter','npc_cafe_customer'];
  const assets = [
    { key: 'background', type: 'map', version: 2, npcId: null }, { key: 'player', type: 'spritesheet', version: 2, npcId: null },
    { key: 'animations', type: 'animation', version: 2, npcId: null }, { key: 'actors', type: 'json', version: 2, npcId: null },
    ...actorIds.map(npcId => ({ key: `npc-${npcId}`, type: 'image', version: 2, npcId: null })),
  ];
  const pack = { mapId: 'loc_cafe', assets };
  const actors = actorIds.map((npcId,index) => ({ npcId, texture: `npc-${npcId}`, frame: 'walk', x: 800 + index * 80, y: 390 + index * 100, scale: 0.6 }));
  const scene = {
    cache: { json: { get: (key) => key.endsWith(':actors:v2') ?
      { actors } :
      { animations: [0, 1, 2, 3].map(row => ({ key: `walk-${row}`, texture: 'player', frames: [row * 4], frameRate: 7, repeat: -1 })) } } },
    textures: { get: () => ({ has: () => true }) }, anims: { create: () => {} },
  };
  assert.deepEqual(preparePack(scene, pack).actors, actors.map(actor => ({ ...actor, texture: `pack:loc_cafe:map:${actor.texture}:v2` })));
});

test('preparePack maps repeated Corner Cup frames to explicit NPC identities', () => {
  const actorIds = ['npc_corner_cup_seller','npc_corner_cup_assistant','npc_corner_cup_customer_1','npc_corner_cup_customer_2','npc_corner_cup_customer_3'];
  const assets = [
    { key: 'background', type: 'map', version: 2, npcId: null }, { key: 'player', type: 'spritesheet', version: 2, npcId: null },
    { key: 'animations', type: 'animation', version: 2, npcId: null }, { key: 'actors', type: 'json', version: 2, npcId: null },
    ...actorIds.map(npcId => ({ key: `npc-${npcId}`, type: 'image', version: 2, npcId: null })),
  ];
  const pack = { mapId: 'loc_corner_cafe', assets };
  const actors = actorIds.map((npcId,index) => ({ npcId, texture: `npc-${npcId}`, frame: 'walk', x: 800 + index * 20, y: 390 + index * 20, scale: 0.6 }));
  const scene = {
    cache: { json: { get: key => key.endsWith(':actors:v2') ? { actors } :
      { animations: [0,1,2,3].map(row => ({ key:`walk-${row}`,texture:'player',frames:[row*4],frameRate:7,repeat:-1 })) } } },
    textures: { get: () => ({ has: () => true }) }, anims: { create: () => {} },
  };
  assert.deepEqual(preparePack(scene,pack).actors,actors.map(actor => ({ ...actor, texture:`pack:loc_corner_cafe:map:${actor.texture}:v2` })));
});

test('preparePack validates and resolves all authored Town Street resident actors', async () => {
  const { STREET_NPCS } = await import('../src/features/npcs/street-npcs.ts');
  const actors = STREET_NPCS.map((npc, index) => ({
    npcId: npc.id, frame: npc.frame, texture: 'street-npcs-1',
    x: 120 + index * 8, y: 400, scale: 0.6,
  }));
  const assets = [
    { key: 'background', type: 'map', version: 5, npcId: null },
    { key: 'player', type: 'spritesheet', version: 5, npcId: null },
    { key: 'animations', type: 'animation', version: 5, npcId: null },
    { key: 'street-npcs-1', type: 'image', version: 5, npcId: null },
    { key: 'street-npcs-1-atlas', type: 'json', version: 5, npcId: null },
    { key: 'actors', type: 'json', version: 5, npcId: null },
  ];
  const pack = { mapId: 'loc_town_street', assets };
  const scene = {
    cache: { json: { get: key => key.endsWith(':actors:v5') ? { actors } :
      { animations: [0, 1, 2, 3].map(row => ({ key: `walk-${row}`, texture: 'player', frames: [row * 4], frameRate: 7, repeat: -1 })) } } },
    textures: { get: () => ({ has: () => true }) }, anims: { create: () => {} },
  };
  const resolved = preparePack(scene, pack).actors;
  assert.equal(resolved.length, 15);
  assert.deepEqual(resolved.map(actor => actor.npcId), STREET_NPCS.map(npc => npc.id));
  assert.ok(resolved.every(actor => actor.texture === 'pack:loc_town_street:map:street-npcs-1:v5'));
});
