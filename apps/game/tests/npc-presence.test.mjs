import assert from 'node:assert/strict';
import test from 'node:test';
import { npcIsVisible } from '../src/features/npcs/npc-presence.ts';

test('NPC-05 Phaser visibility and interaction allow only present actors', () => {
  const present = new Set(['npc_mila_florist']);
  assert.equal(npcIsVisible('street', 'npc_mila_florist', present), true);
  assert.equal(npcIsVisible('street', 'npc_amir_courier', present), false);
  assert.equal(npcIsVisible('cafe', 'npc_mia', new Set()), false);
  assert.equal(npcIsVisible('station', 'npc_station_information', new Set()), true);
  assert.equal(npcIsVisible('street', 'npc_amir_courier', null), true, 'local practice remains unaffected');
});
