import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { chatStreamRequestSchema, conversationTurnSchema, sendMessageSchema } from '../dist/index.js';

test('T10e chat stream requests require owned conversation coordinates and at most 300 trimmed characters', () => {
  const valid = { npcId: 'npc_mila_florist', conversationId: randomUUID(), clientMessageId: randomUUID(),
    text: '  Do you like football?  ' };
  assert.equal(chatStreamRequestSchema.parse(valid).text, 'Do you like football?');
  for (const invalid of [{ ...valid, text: ' ' }, { ...valid, text: 'x'.repeat(301) },
    { ...valid, conversationId: 'bad' }, { ...valid, npcId: 'unknown' }, { ...valid, userId: randomUUID() },
    { ...valid, coach: false }]) {
    assert.equal(chatStreamRequestSchema.safeParse(invalid).success, false);
  }
  assert.equal(sendMessageSchema.safeParse({ clientMessageId: valid.clientMessageId, text: valid.text, coach: false }).success, false);
});

test('T10e conversation metadata marks only complete AI replies', () => {
  const base = { intent: null, misunderstood: true,
    arrival: { questId: 'q_station_arrival', status: 'active', currentStepId: 'arrival_ask',
      ticket: { issued: false, used: false }, canEnterTownStreet: false, locationId: 'loc_station', rewardsGranted: false },
    playerMessage: { id: randomUUID(), sender: 'player', text: 'Hello', createdAt: new Date().toISOString() },
    npcMessage: { id: randomUUID(), sender: 'npc', text: 'Hi', createdAt: new Date().toISOString() } };
  assert.equal(conversationTurnSchema.parse({ ...base, ai: true }).ai, true);
  assert.equal(conversationTurnSchema.safeParse({ ...base, ai: false }).success, false);
  assert.equal(conversationTurnSchema.safeParse({ ...base, correction: null }).success, false);
});
