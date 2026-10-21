import assert from 'node:assert/strict';
import test from 'node:test';
import type { VoicePools } from '@life-abroad/shared';
import { resolveNpcVoice } from '../modules/speech/voice-selection';
import { resolveAzureStyle } from '../modules/speech/azure-speech.provider';

const pools: VoicePools = {
  version: 1,
  voices: {
    female: ['en-US-AvaNeural', 'en-US-JennyNeural'],
    male: ['en-US-AndrewNeural', 'en-US-GuyNeural'],
  },
  voiceOverrides: { npc_override: 'en-US-GuyNeural' },
  styleSupport: {},
};

test('NPC voice follows gender and remains stable', () => {
  const female = resolveNpcVoice('npc_stable', 'female', pools);
  const male = resolveNpcVoice('npc_stable', 'male', pools);
  assert.match(female, /^en-US-(?:Ava|Jenny)Neural$/);
  assert.match(male, /^en-US-(?:Andrew|Guy)Neural$/);
  assert.equal(resolveNpcVoice('npc_stable', 'female', pools), female);
  assert.notEqual(female, male, 'changing gender must switch to the other pool');
});

test('stable IDs distribute NPCs within one gender pool', () => {
  const voices = new Set(['npc_alpha', 'npc_beta', 'npc_gamma', 'npc_delta']
    .map(npcId => resolveNpcVoice(npcId, 'female', pools)));
  assert.deepEqual(voices, new Set(['en-US-AvaNeural', 'en-US-JennyNeural']));
});

test('an NPC override wins over its gender pool', () => {
  assert.equal(resolveNpcVoice('npc_override', 'male', pools), 'en-US-GuyNeural');
});

test('speech styles use supported provider mappings with a neutral fallback', () => {
  assert.equal(resolveAzureStyle('happy', ['cheerful']), 'cheerful');
  assert.equal(resolveAzureStyle('sad', ['sad']), 'sad');
  assert.equal(resolveAzureStyle('happy', []), 'default');
  for (const mood of ['hungry', 'stressed', 'tired', 'relaxed', 'sleepy', 'upset', 'angry'] as const) {
    assert.equal(resolveAzureStyle(mood, ['cheerful', 'sad']), 'default');
  }
});
