import assert from 'node:assert/strict';
import test from 'node:test';
import { SHOP_NPCS, isShopNpc } from '../src/features/shops/shop-npcs.ts';
import { nearestNpc } from '../src/gameplay/station-navigation.ts';

test('each uploaded shop NPC resolves to a supported dialogue target', () => {
  assert.equal(SHOP_NPCS.length, 11);
  assert.equal(new Set(SHOP_NPCS.map(npc => npc.id)).size, SHOP_NPCS.length);
  for (const npc of SHOP_NPCS) {
    assert.equal(isShopNpc(npc.id), true);
    assert.equal(nearestNpc({ x: 800, y: 330 }, [{ ...npc, texture: 'atlas', x: 800, y: 275 }])?.id, npc.id);
  }
  assert.equal(isShopNpc('npc_unknown'), false);
});

test('Corner Cup has a seller, assistant and three distinct customer NPCs', () => {
  const cornerCup = SHOP_NPCS.filter(npc => npc.id.startsWith('npc_corner_cup_'));
  assert.equal(cornerCup.length, 5);
  assert.ok(cornerCup.some(npc => npc.id === 'npc_corner_cup_seller'));
  assert.ok(cornerCup.some(npc => npc.id === 'npc_corner_cup_assistant'));
  assert.equal(cornerCup.filter(npc => npc.id.includes('customer')).length, 3);
});

