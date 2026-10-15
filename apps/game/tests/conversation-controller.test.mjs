import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });

try {
  const { createConversationController } = await server.ssrLoadModule('/src/features/dialogue/conversation-controller.ts');

  test('a successful send trusts the turn response without refetching the conversation', async () => {
    const initialArrival = {
      questId: 'q_station_arrival', status: 'active', currentStepId: 'arrival_ask',
      ticket: { issued: false, used: false }, canEnterTownStreet: false,
      locationId: 'loc_station', rewardsGranted: false,
    };
    const updatedArrival = {
      ...initialArrival, currentStepId: 'arrival_ticket', ticket: { issued: true, used: false },
      canEnterTownStreet: true,
    };
    const openingMessage = { id: '00000000-0000-4000-8000-000000000001', sender: 'npc', text: 'Hello.', createdAt: '2026-10-15T08:00:00.000Z' };
    const playerMessage = { id: '00000000-0000-4000-8000-000000000002', sender: 'player', text: 'A ticket, please.', createdAt: '2026-10-15T08:01:00.000Z' };
    const npcMessage = { id: '00000000-0000-4000-8000-000000000003', sender: 'npc', text: 'Here you are.', createdAt: '2026-10-15T08:01:01.000Z' };
    let loadCalls = 0;
    const controller = createConversationController({
      load: async () => { loadCalls += 1; return initialArrival; },
      start: async () => ({ id: '00000000-0000-4000-8000-000000000004', npcId: 'npc_receptionist', messages: [openingMessage], arrival: initialArrival }),
      send: async () => ({ playerMessage, npcMessage, intent: 'request_ticket', misunderstood: false, correction: null, arrival: updatedArrival }),
    });

    assert.equal(await controller.load(), true);
    assert.equal(await controller.start(), true);
    assert.equal(await controller.send('A ticket, please.'), true);

    const snapshot = controller.getSnapshot();
    assert.equal(loadCalls, 1);
    assert.deepEqual(snapshot.arrival, updatedArrival);
    assert.deepEqual(snapshot.conversation?.messages, [openingMessage, playerMessage, npcMessage]);
  });
} finally {
  await server.close();
}
