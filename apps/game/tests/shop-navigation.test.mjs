import assert from 'node:assert/strict';
import test from 'node:test';
import { moveInShop, shopCanWalk } from '../src/features/shops/shop-navigation.ts';
import { findPath } from '../src/gameplay/station-navigation.ts';
import { npcVoice } from '../src/speech/npc-voice.ts';

test('shop furniture, walls and NPC bodies block movement including large deltas', () => {
  for (const [map, obstacle] of [['cafe', { x: 250, y: 500 }], ['clothes', { x: 350, y: 460 }]]) {
    assert.equal(shopCanWalk(map, obstacle), false);
    assert.equal(shopCanWalk(map, { x: 500, y: 920 }), false);
    const start = { x: 768, y: 500 };
    const stopped = moveInShop(map, start, { x: -1000, y: 0 });
    assert.ok(stopped.x > obstacle.x);
    assert.equal(shopCanWalk(map, stopped), true);
    const npc = { x: 768, y: 600 };
    const near = moveInShop(map, start, { x: 0, y: 250 }, [npc]);
    assert.ok(near.y <= 562);
    assert.equal(shopCanWalk(map, npc, [npc]), false);
  }
});
test('clothes seller can be reached around the display table without crossing furniture', () => {
  const npcs = [{ x: 1005, y: 405 }];
  const canWalk = point => shopCanWalk('clothes', point, npcs);
  const path = findPath({ x: 768, y: 860 }, { x: 1005, y: 460 }, canWalk, (p,d) => moveInShop('clothes',p,d,npcs));
  assert.ok(path.length > 0);
  assert.ok(path.every(canWalk));
});
test('shop voices match authored character genders and preserve station voices', () => {
  for (const id of ['npc_mia','npc_cafe_customer','npc_clothes_customer','npc_station_information']) assert.equal(npcVoice[id], 'female');
  for (const id of ['npc_cafe_waiter','npc_clothes_seller','npc_clothes_assistant','npc_passenger_suitcase']) assert.equal(npcVoice[id], 'male');
});
