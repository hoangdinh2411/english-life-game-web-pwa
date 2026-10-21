import assert from 'node:assert/strict';
import test from 'node:test';
import type { ConversationMessage } from '@life-abroad/shared';
import { ConversationSpeechService, withinSpeechReplyBudget } from '../modules/speech/conversation-speech.service';
import type { SpeechCacheIdentity } from '../modules/speech/fixed-speech.service';
import type { AiSpeechIdentity } from '../modules/speech/ai-speech.service';

const npc = 'npc_mila_florist';
const identity: AiSpeechIdentity = { language: 'en-US', voice: 'en-US-JennyNeural', style: 'default',
  format: 'audio-24khz-48kbitrate-mono-mp3', ttsVersion: 'rest-v1', settings: {} };
const message = (id: string, text: string, ai = false): ConversationMessage => ({
  id, sender: 'npc', text, createdAt: '2026-10-19T10:00:00.000Z', ...(ai ? { ai: true as const } : {}),
});

test('opening, shared, NPC-specific, history and AI messages receive private speech URLs', async () => {
  const fixedTexts: string[] = [];
  const aiIds: string[] = [];
  const service = new ConversationSpeechService({ get: async (input: SpeechCacheIdentity) => {
    fixedTexts.push(input.text); return { cacheKey: 'fixed', path: 'fixed.mp3', url: `https://audio.test/${encodeURIComponent(input.text)}` };
  } } as never, { get: async (_userId: string, id: string) => {
    aiIds.push(id); return { cacheKey: 'ai', path: 'ai.mp3', url: `https://audio.test/ai/${id}` };
  } } as never, { identity: async () => identity } as never);
  const opening = message('00000000-0000-4000-8000-000000000001', 'Welcome!');
  const shared = message('00000000-0000-4000-8000-000000000002', 'Could you repeat that?');
  const specific = message('00000000-0000-4000-8000-000000000003', 'These flowers arrived today.');
  const generated = message('00000000-0000-4000-8000-000000000004', 'Autumn is lovely here.', true);

  const conversation = await service.conversation('user', { id: '00000000-0000-4000-8000-000000000010', npcId: npc,
    arrival: { questId: 'q_station_arrival', status: 'done', currentStepId: null,
      ticket: { issued: true, used: true }, canEnterTownStreet: true, locationId: 'loc_town_street', rewardsGranted: true },
    messages: [opening, shared, specific] });
  const history = await service.history('user', npc, { messages: [generated], hasMore: false, beforeMessageId: null });

  assert.deepEqual(fixedTexts, ['Welcome!', 'Could you repeat that?', 'These flowers arrived today.']);
  assert.deepEqual(aiIds, [generated.id]);
  assert.ok(conversation.messages.every(item => item.speech?.url.startsWith('https://audio.test/')));
  assert.match(history.messages[0]!.speech!.url, /\/ai\//);
});

test('player messages and speech failures preserve readable conversation text', async () => {
  const service = new ConversationSpeechService({ get: async () => { throw new Error('Azure unavailable'); } } as never,
    { get: async () => { throw new Error('storage unavailable'); } } as never,
    { identity: async () => identity } as never);
  const npcMessage = message('00000000-0000-4000-8000-000000000005', 'Text remains readable.');
  const playerMessage: ConversationMessage = { ...npcMessage, id: '00000000-0000-4000-8000-000000000006', sender: 'player' };

  assert.deepEqual(await service.message('user', npc, npcMessage), npcMessage);
  assert.deepEqual(await service.message('user', npc, playerMessage), playerMessage);
});

test('a slow speech dependency cannot consume the conversation response deadline', async () => {
  const startedAt = Date.now();
  await assert.rejects(withinSpeechReplyBudget(new Promise<never>(() => undefined), 1), /Speech generation timed out/);
  assert.ok(Date.now() - startedAt < 1_000);
});
