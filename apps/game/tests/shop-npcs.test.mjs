import assert from 'node:assert/strict';
import test from 'node:test';
import { SHOP_NPCS, isShopNpc } from '../src/features/shops/shop-npcs.ts';
import { nearestNpc } from '../src/gameplay/station-navigation.ts';

test('each uploaded shop frame resolves to a distinct supported dialogue target', () => {
  assert.equal(SHOP_NPCS.length, 6);
  assert.equal(new Set(SHOP_NPCS.map(npc => npc.frame)).size, 6);
  for (const npc of SHOP_NPCS) {
    assert.equal(isShopNpc(npc.id), true);
    assert.equal(nearestNpc({ x: 800, y: 330 }, [{ ...npc, texture: 'atlas', x: 800, y: 275 }])?.id, npc.id);
  }
  assert.equal(isShopNpc('npc_unknown'), false);
});

