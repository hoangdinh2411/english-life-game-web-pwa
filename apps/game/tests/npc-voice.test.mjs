import test from 'node:test';
import assert from 'node:assert/strict';
import { npcPlaybackSettings, npcVoice } from '../src/speech/npc-voice.ts';

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

test('each NPC receives a stable, audibly varied pitch while player speed remains adjustable', () => {
  const miaPitch = npcPlaybackSettings('npc_mia', 1).speechPitch;
  assert.deepEqual(npcPlaybackSettings('npc_mia', 1.25), { speechRate: 1.25, speechPitch: miaPitch });
  assert.deepEqual(npcPlaybackSettings('npc_mia', 0.8), { speechRate: 0.8, speechPitch: miaPitch });
  assert.equal(npcPlaybackSettings(undefined, 1).speechPitch, 1);

  const pitches = Object.keys(npcVoice).map(id => npcPlaybackSettings(id, 1).speechPitch);
  assert.ok(pitches.every(pitch => pitch >= 0.85 && pitch <= 1.15));
  assert.equal(new Set(pitches).size, pitches.length);
  assert.ok(Math.min(...pitches) <= 0.9, 'NPC roster needs an audibly lower voice');
  assert.ok(Math.max(...pitches) >= 1.1, 'NPC roster needs an audibly higher voice');
});
