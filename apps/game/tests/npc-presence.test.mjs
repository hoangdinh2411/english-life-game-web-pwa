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

test('responsive rerenders do not restart the Phaser game for an unchanged location', async () => {
  const source = await readFile(new URL('../src/gameplay/GameCanvas.tsx', import.meta.url), 'utf8');
  assert.match(source, /const DEFAULT_INITIAL_LOCATION = \{/);
  assert.match(source, /const initialMapId = initialLocation\.mapId;/);
  assert.match(source, /\}, \[attempt, initialMapId, initialPlaceId, initialX, initialY, serverExit\]\);/);
  assert.doesNotMatch(source, /\}, \[attempt, initialLocation, serverExit\]\);/);
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
  const current = ['npc_station_information', 'npc_passenger_visitor'];
  const next = ['npc_station_information', 'npc_passenger_backpack'];
  assert.deepEqual([...npcPresence.effectiveNpcIds(next, 'npc_passenger_visitor', current)], current);
  assert.deepEqual([...npcPresence.effectiveNpcIds(next, null, current)], next);
});
