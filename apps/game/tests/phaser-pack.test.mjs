/* global AbortController */
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPack, preparePack } from '../src/features/assets/phaser-pack.ts';

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

// Catches ignoring uploaded actor placement or displaying a frame from another shop.
test('preparePack resolves authored actor frames and positions', () => {
  const assets = ['background', 'player', 'animations', 'shop-npcs', 'actors'].map((key, index) => ({
    key, type: ['map', 'spritesheet', 'animation', 'image', 'json'][index], version: 2, npcId: null,
  }));
  const pack = { mapId: 'loc_cafe', assets };
  const actors = ['cafe_seller','cafe_waiter','cafe_customer'].map((frame,index) => ({ texture: 'shop-npcs', frame, x: 800 + index * 80, y: 390 + index * 100, scale: 0.6 }));
  const scene = {
    cache: { json: { get: (key) => key.endsWith(':actors:v2') ?
      { actors } :
      { animations: [0, 1, 2, 3].map(row => ({ key: `walk-${row}`, texture: 'player', frames: [row * 4], frameRate: 7, repeat: -1 })) } } },
    textures: { get: () => ({ has: () => true }) }, anims: { create: () => {} },
  };
  assert.deepEqual(preparePack(scene, pack).actors, actors.map((actor,index) => ({ ...actor, npcId: ['npc_mia','npc_cafe_waiter','npc_cafe_customer'][index], texture: 'pack:loc_cafe:map:shop-npcs:v2' })));
});

test('preparePack maps repeated Corner Cup frames to explicit NPC identities', () => {
  const assets = ['background', 'player', 'animations', 'shop-npcs', 'actors'].map((key, index) => ({
    key, type: ['map', 'spritesheet', 'animation', 'image', 'json'][index], version: 2, npcId: null,
  }));
  const pack = { mapId: 'loc_corner_cafe', assets };
  const actorIds = ['npc_corner_cup_seller','npc_corner_cup_assistant','npc_corner_cup_customer_1','npc_corner_cup_customer_2','npc_corner_cup_customer_3'];
  const frames = ['cafe_seller','cafe_waiter','cafe_customer','clothes_customer','cafe_customer'];
  const actors = actorIds.map((npcId,index) => ({ npcId, texture: 'shop-npcs', frame: frames[index], x: 800 + index * 20, y: 390 + index * 20, scale: 0.6 }));
  const scene = {
    cache: { json: { get: key => key.endsWith(':actors:v2') ? { actors } :
      { animations: [0,1,2,3].map(row => ({ key:`walk-${row}`,texture:'player',frames:[row*4],frameRate:7,repeat:-1 })) } } },
    textures: { get: () => ({ has: () => true }) }, anims: { create: () => {} },
  };
  assert.deepEqual(preparePack(scene,pack).actors,actors.map(actor => ({ ...actor, texture:'pack:loc_corner_cafe:map:shop-npcs:v2' })));
});
