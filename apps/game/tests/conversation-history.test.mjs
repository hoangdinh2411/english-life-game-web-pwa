import test from 'node:test';
import assert from 'node:assert/strict';
import { appendMessage, thinkingSpeaker } from '../src/gameplay/conversation-history.ts';
test('conversation preserves both speakers and the complete ordered history', () => {
  const initial = appendMessage([], 'npc', 'Welcome!');
  const player = appendMessage(initial, 'player', 'Hello!');
  const reply = appendMessage(player, 'npc', 'How can I help?');
  assert.deepEqual(reply.map(({ id, speaker }) => [id, speaker]), [[1, 'npc'], [2, 'player'], [3, 'npc']]);
  assert.equal(initial.length, 1);
});
test('recording shows the player thinking; waiting shows the NPC thinking', () => {
  assert.equal(thinkingSpeaker(true, false), 'player');
  assert.equal(thinkingSpeaker(false, true), 'npc');
  assert.equal(thinkingSpeaker(false, false), null);
});
