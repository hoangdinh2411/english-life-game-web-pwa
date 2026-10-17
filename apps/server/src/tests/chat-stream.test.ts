import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { ChatStreamRequest, ConversationTurn } from '@life-abroad/shared';
import { ChatStreamService, type ChatEvent } from '../modules/conversations/chat-stream.service';
import { ConversationsService } from '../modules/conversations/conversations.service';

const request: ChatStreamRequest = {
  npcId: 'npc_mila_florist', conversationId: randomUUID(), clientMessageId: randomUUID(),
  text: 'Do you like football?', coach: false,
};
const turn = { npcMessage: { text: 'Hello there friend' } } as ConversationTurn;

test('T10e forwards checked chunks without fake word delays and emits done only after save', async () => {
  let saved = false;
  const module = await Test.createTestingModule({ providers: [ChatStreamService, {
    provide: ConversationsService, useValue: { sendStreaming: async (
      _userId: string, _id: string, _npcId: string, _request: unknown,
      beforeSave: (text: string) => Promise<void>,
    ) => {
      await beforeSave('Hello there ');
      await beforeSave('friend');
      saved = true;
      return turn;
    } },
  }] }).compile();
  try {
    const events: ChatEvent[] = [];
    await module.get(ChatStreamService).stream('user-one', request, event => events.push(event), new AbortController().signal);
    assert.deepEqual(events.map(event => event.event), ['token', 'token', 'done']);
    assert.deepEqual(events.slice(0, 2).map(event => event.data), [{ text: 'Hello there ' }, { text: 'friend' }]);
    assert.equal(saved, true);
  } finally { await module.close(); }
});

test('T10e allows only one active stream per user and releases the slot after cancellation', async () => {
  let begin: (() => void) | undefined;
  let finish: (() => void) | undefined;
  const started = new Promise<void>(resolve => { begin = resolve; });
  const blocked = new Promise<void>(resolve => { finish = resolve; });
  const module = await Test.createTestingModule({ providers: [ChatStreamService, {
    provide: ConversationsService, useValue: { sendStreaming: async () => { begin?.(); await blocked; return turn; } },
  }] }).compile();
  try {
    const service = module.get(ChatStreamService);
    const first = service.stream('same-user', request, () => undefined, new AbortController().signal);
    await started;
    await assert.rejects(service.stream('same-user', request, () => undefined, new AbortController().signal),
      /Finish the current chat reply first/);
    finish?.();
    await first;
    await service.stream('same-user', request, () => undefined, new AbortController().signal);
  } finally { finish?.(); await module.close(); }
});
