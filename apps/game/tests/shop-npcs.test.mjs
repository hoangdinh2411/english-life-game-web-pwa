import assert from 'node:assert/strict';
import test from 'node:test';
import { SHOP_NPCS, SERVICE_NPC_IDS, isShopNpc, isServiceNpc } from '../src/features/shops/shop-npcs.ts';
import { findPath, nearestNpc, STATION_NPCS } from '../src/gameplay/station-navigation.ts';
import { moveInShop, shopCanWalk } from '../src/features/shops/shop-navigation.ts';
import { npcVoice } from '../src/speech/npc-voice.ts';

test('each uploaded shop NPC resolves to a supported dialogue target', () => {
  assert.equal(SHOP_NPCS.length, 11);
  assert.equal(new Set(SHOP_NPCS.map(npc => npc.id)).size, SHOP_NPCS.length);
  for (const npc of SHOP_NPCS) {
    assert.equal(isShopNpc(npc.id), true);
    assert.equal(nearestNpc({ x: 800, y: 330 }, [{ ...npc, texture: 'atlas', x: 800, y: 275 }])?.id, npc.id);
  }
  assert.equal(isShopNpc('npc_unknown'), false);
});

test('every shop and station NPC has a distinct personal name', () => {
  const names = [...SHOP_NPCS, ...STATION_NPCS].map(npc => npc.name);
  assert.equal(new Set(names).size, names.length);
  for (const name of names) assert.match(name, /^[A-Z][a-z]+$/);
});

test('shop NPC voices match their authored identities', () => {
  const femaleNames = new Set(['Mia', 'Elena', 'Olivia', 'Ava', 'Leah', 'Grace', 'Nora']);
  for (const npc of SHOP_NPCS) {
    const isFemale = femaleNames.has(npc.name);
    assert.equal(npcVoice[npc.id], isFemale ? 'female' : 'male', `${npc.id} voice`);
    assert.equal(npc.frame, 'walk');
  }
});

test('closed store hours block shop interiors but never block the street', async () => {
  const navigation = await import('../src/features/shops/shop-navigation.ts');
  assert.equal(typeof navigation.canEnterLocation, 'function');
  const { canEnterLocation } = navigation;
  const at = (hour, minute) => new Date(Date.UTC(2026, 9, 13, hour, minute));
  assert.equal(canEnterLocation('cafe', at(7, 59), 'UTC'), false);
  assert.equal(canEnterLocation('corner_cafe', at(8, 0), 'UTC'), true);
  assert.equal(canEnterLocation('clothes', at(13, 59), 'UTC'), true);
  assert.equal(canEnterLocation('cafe', at(14, 0), 'UTC'), false);
  assert.equal(canEnterLocation('cafe', at(12, 0), 'Europe/Stockholm'), false, '14:00 local is closed');
  assert.equal(canEnterLocation('cafe', at(12, 0), 'America/New_York'), true, '08:00 local is open');
  assert.equal(canEnterLocation('corner_cafe', null, 'UTC'), false);
  assert.equal(canEnterLocation('tax_office', at(7, 59), 'UTC'), false);
  assert.equal(canEnterLocation('tax_office', at(8, 0), 'UTC'), true);
  assert.equal(canEnterLocation('tax_office', at(15, 59), 'UTC'), true);
  assert.equal(canEnterLocation('tax_office', at(16, 0), 'UTC'), false);
  assert.equal(canEnterLocation('street', null, null), true);
});

test('Corner Cup has a seller, assistant and three distinct customer NPCs', () => {
  const cornerCup = SHOP_NPCS.filter(npc => npc.id.startsWith('npc_corner_cup_'));
  assert.equal(cornerCup.length, 5);
  assert.ok(cornerCup.some(npc => npc.id === 'npc_corner_cup_seller'));
  assert.ok(cornerCup.some(npc => npc.id === 'npc_corner_cup_assistant'));
  assert.equal(cornerCup.filter(npc => npc.id.includes('customer')).length, 3);
});

test('required store staff use the bundled service-asset path', () => {
  assert.equal(SERVICE_NPC_IDS.length, 6);
  assert.ok(SERVICE_NPC_IDS.every(isServiceNpc));
  assert.equal(isServiceNpc('npc_corner_cup_customer_1'), false);
});

test('both Tax Office staff have reachable interaction points that do not block the entrance', () => {
  const staff = [{ x: 770, y: 500 }, { x: 920, y: 760 }];
  const start = { x: 768, y: 860 };
  const approaches = [{ x: 770, y: 555 }, { x: 920, y: 705 }];
  for (const target of approaches) {
    assert.equal(shopCanWalk('tax_office', target, staff), true);
    assert.ok(findPath(start, target,
      point => shopCanWalk('tax_office', point, staff),
      (point, delta) => moveInShop('tax_office', point, delta, staff)).length > 0);
  }
  assert.equal(shopCanWalk('tax_office', start, staff), true, 'the entrance remains clear');
});

