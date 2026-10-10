import assert from 'node:assert/strict';
import test from 'node:test';
import { dialogueMetadataSchema, practiceDialogueNodeSchema, stationReply } from '../dist/index.js';

test('metadata is optional for existing authored and practice nodes', () => {
  assert.deepEqual(dialogueMetadataSchema.parse({ id: 'old', text: { default: 'Hello!' } }), {});
  assert.deepEqual(practiceDialogueNodeSchema.parse({ text: 'Hello!' }), { text: 'Hello!' });
});

test('context and learning-focus tags preserve author intent', () => {
  const metadata = { context: { topic: 'journey', timeReference: 'completed_past', expectedIntents: ['describe_journey'] }, learningFocus: ['past_simple'] };
  assert.deepEqual(dialogueMetadataSchema.parse(metadata), metadata);
});

test('metadata rejects malformed values, misspelled context fields and duplicate tags', () => {
  for (const metadata of [
    { context: null }, { context: { timeReference: 'yesterday' } },
    { context: { topic: 3 } }, { context: { tense: 'past' } },
    { context: { expectedIntents: 'greet' } }, { learningFocus: [''] },
    { learningFocus: ['past_simple', 'past_simple'] }, { learningFocus: 'past_simple' },
  ]) assert.equal(dialogueMetadataSchema.safeParse(metadata).success, false);
});

test('tags do not impose tense or reject conversational fragments', () => {
  for (const input of ['It was good.', 'A little tiring.', 'I’m tired now, but the journey was lovely.']) {
    const reply = stationReply('npc_passenger_suitcase', 0, input);
    assert.equal(reply.correction, undefined);
    assert.equal(reply.step, 0);
  }
});
