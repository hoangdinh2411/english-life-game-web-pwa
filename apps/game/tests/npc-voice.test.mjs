import test from 'node:test';
import assert from 'node:assert/strict';
import { npcVoice } from '../src/speech/npc-voice.ts';

test('station NPC voices follow the genders shown in their portraits', () => {
  assert.deepEqual(npcVoice, {
    npc_station_information: 'female',
    npc_passenger_backpack: 'female',
    npc_passenger_suitcase: 'male',
  });
});
