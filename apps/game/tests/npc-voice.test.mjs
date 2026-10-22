import test from 'node:test';
import assert from 'node:assert/strict';
import { npcVoice } from '../src/speech/npc-voice.ts';

test('station NPC voices follow all four stable identities', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(npcVoice).filter(([id]) => ['npc_station_information','npc_passenger_backpack','npc_passenger_suitcase','npc_passenger_visitor'].includes(id))), {
    npc_station_information: 'female',
    npc_passenger_backpack: 'female',
    npc_passenger_suitcase: 'male',
    npc_passenger_visitor: 'female',
  });
});

test('each data-authored Town Street resident has a configured voice', async () => {
  const { STREET_NPCS } = await import('../src/features/npcs/street-npcs.ts');
  for (const npc of STREET_NPCS) assert.equal(npcVoice[npc.id], npc.voice, npc.id);
});
