import assert from 'node:assert/strict';
import test from 'node:test';
import { ConversationsService } from '../modules/conversations/conversations.service';

test('conversation opening skips speech work only when the client disabled speech', async () => {
  let speechCalls = 0;
  const arrival = { questId: 'q_station_arrival', status: 'done', currentStepId: null,
    ticket: { issued: true, used: true }, canEnterTownStreet: true,
    locationId: 'loc_tax_office', rewardsGranted: true };
  const repository = {
    transaction: async (work: (client: object) => Promise<unknown>) => work({}),
    discardTransientForNpc: async () => undefined,
    variationIndex: async () => 0,
    context: async () => ({ npcId: 'npc_tax_clerk_nadia', npcName: 'Nadia', roleId: 'tax_clerk', personality: 'helpful' }),
    create: async () => '00000000-0000-4000-8000-000000000001',
  };
  const speech = { conversation: async (_userId: string, conversation: { messages: Array<object> }) => {
    speechCalls += 1;
    return { ...conversation, messages: conversation.messages.map(message => ({ ...message,
      speech: { url: 'https://storage.test/opening.mp3' } })) };
  } };
  const service = new ConversationsService(repository as never,
    { node: async () => ({ text: 'Hello! How can I help you?' }) } as never,
    { getArrival: async () => arrival } as never, {} as never, {} as never, {} as never, {} as never,
    speech as never, { assertCanStart: async () => undefined } as never,
    { opening: async () => null, summary: async () => undefined } as never);

  const silent = await service.create('user-1', 'npc_tax_clerk_nadia', false);
  assert.equal(speechCalls, 0);
  assert.equal(silent.messages[0]?.speech, undefined);

  const spoken = await service.create('user-1', 'npc_tax_clerk_nadia', true);
  assert.equal(speechCalls, 1);
  assert.equal(spoken.messages[0]?.speech?.url, 'https://storage.test/opening.mp3');
});
