import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { npcIsVisible } from '../src/features/npcs/npc-presence.ts';
import * as npcPresence from '../src/features/npcs/npc-presence.ts';

test('NPC-05 Phaser visibility and interaction allow only present actors', () => {
  const present = new Set(['npc_mila_florist']);
  assert.equal(npcIsVisible('street', 'npc_mila_florist', present), true);
  assert.equal(npcIsVisible('street', 'npc_amir_courier', present), false);
  assert.equal(npcIsVisible('cafe', 'npc_mia', new Set()), false);
  assert.equal(npcIsVisible('station', 'npc_station_information', new Set()), true);
  assert.equal(npcIsVisible('street', 'npc_amir_courier', null), true, 'local practice remains unaffected');
});

test('GameCanvas forwards Phaser map changes so presence refreshes for the destination map', async () => {
  const source = await readFile(new URL('../src/gameplay/GameCanvas.tsx', import.meta.url), 'utf8');
  assert.match(source, /onMapChange:\s*\(mapId\)\s*=>\s*\{\s*if \(!cancelled\) callbacks\.current\.onMapChange\?\.\(mapId\);\s*\}/);
});

test('NPC presence received before Phaser startup is applied when the game becomes ready', () => {
  assert.equal(typeof npcPresence.syncNpcPresence, 'function');
  const updates = [];
  npcPresence.syncNpcPresence({ setPresentNpcIds: ids => updates.push(ids) }, ['npc_jamal_dog_walker']);
  assert.deepEqual(updates, [['npc_jamal_dog_walker']]);
  npcPresence.syncNpcPresence(null, ['npc_mila_florist']);
  assert.deepEqual(updates, [['npc_jamal_dog_walker']]);
});

test('controlled presence retains an active speaker until reconciliation', () => {
  const selected = ['npc_station_information', 'npc_passenger_backpack'];
  assert.deepEqual([...npcPresence.effectiveNpcIds(selected, 'npc_passenger_visitor')], [
    'npc_station_information', 'npc_passenger_backpack', 'npc_passenger_visitor',
  ]);
  assert.deepEqual([...npcPresence.effectiveNpcIds(selected, null)], selected);
});
