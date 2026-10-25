import assert from 'node:assert/strict';
import test from 'node:test';
import type { ConversationMessage } from '@life-abroad/shared';
import {
  evaluateFarewell,
  openingMessageId,
} from '../modules/conversations/conversation-policy';

function message(
  sender: ConversationMessage['sender'],
  text: string,
  index: number,
): ConversationMessage {
  return {
    id: `00000000-0000-4000-8000-${index.toString().padStart(12, '0')}`,
    sender,
    text,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

test('opening message IDs are deterministic UUIDs scoped to a conversation', () => {
  const first = openingMessageId('conversation-one');
  assert.equal(first, openingMessageId('conversation-one'));
  assert.notEqual(first, openingMessageId('conversation-two'));
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('a first goodbye asks for confirmation and does not inspect unrelated questions', () => {
  assert.deepEqual(
    evaluateFarewell([message('npc', 'Where are you going?', 1)], 'Goodbye'),
    {
      currentIsGoodbye: true,
      response: {
        text: 'Before you go, will you come back tomorrow?',
        stage: 'question',
      },
    },
  );
});

test('an answer after the farewell question closes the conversation', () => {
  const history = [
    message('player', 'Goodbye', 1),
    message('npc', 'Before you go, will you come back tomorrow?', 2),
  ];
  assert.deepEqual(evaluateFarewell(history, 'Yes, I will.'), {
    currentIsGoodbye: false,
    response: {
      text: 'That would be lovely. I hope to see you tomorrow. Goodbye!',
      stage: 'confirm',
    },
  });
});

test('a goodbye without a later NPC question does not confirm the farewell', () => {
  const history = [
    message('npc', 'Welcome.', 1),
    message('player', 'Goodbye', 2),
  ];
  assert.deepEqual(evaluateFarewell(history, 'One more thing.'), {
    currentIsGoodbye: false,
  });
});
