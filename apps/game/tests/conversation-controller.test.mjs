import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });

try {
  const { createConversationController, revealStreamChunk } = await server.ssrLoadModule('/src/features/dialogue/conversation-controller.ts');

  test('safe sentence chunks are revealed as paced characters for a visible typing animation', async () => {
    const pieces = [];
    let waits = 0;
    await revealStreamChunk('Hi!', piece => pieces.push(piece), undefined, async () => { waits += 1; });
    assert.deepEqual(pieces, ['H', 'i', '!']);
    assert.equal(waits, 2);
  });

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

  test('T10f reveals streamed text progressively and cancels it on dispose', async () => {
    const arrival = { questId: 'q_station_arrival', status: 'active', currentStepId: null,
      ticket: { issued: false, used: false }, canEnterTownStreet: false, locationId: 'loc_station', rewardsGranted: false };
    const conversation = { id: globalThis.crypto.randomUUID(), npcId: 'npc_receptionist', messages: [], arrival };
    let release;
    let capturedSignal;
    const controller = createConversationController({ load: async () => arrival, start: async () => conversation,
      send: async () => { throw new Error('Non-streaming API must not be used'); },
      stream: async (_id, _npcId, body, onToken, signal) => {
        capturedSignal = signal;
        onToken('Hello '); onToken('there.');
        await new Promise(resolve => { release = resolve; });
        return { playerMessage: { id: globalThis.crypto.randomUUID(), sender: 'player', text: body.text, createdAt: new Date().toISOString() },
          npcMessage: { id: globalThis.crypto.randomUUID(), sender: 'npc', text: 'Hello there.', createdAt: new Date().toISOString(), ai: true },
          intent: null, misunderstood: false, correction: null, arrival, ai: true };
      } });
    await controller.start();
    const sending = controller.send('Hi');
    await new Promise(resolve => globalThis.setTimeout(resolve, 0));
    assert.equal(controller.getSnapshot().streamedReply, 'H');
    assert.equal(controller.getSnapshot().streaming, true);
    controller.dispose();
    assert.equal(capturedSignal.aborted, true);
    release();
    assert.equal(await sending, false);
  });

  test('completed generated replies use a provider-neutral announcement', async () => {
    const arrival = { questId: 'q_station_arrival', status: 'done', currentStepId: null,
      ticket: { issued: true, used: true }, canEnterTownStreet: true, locationId: 'loc_town_street', rewardsGranted: true };
    const conversation = { id: globalThis.crypto.randomUUID(), npcId: 'npc_raj_pharmacist', messages: [], arrival };
    const controller = createConversationController({ load: async () => arrival, start: async () => conversation,
      send: async () => { throw new Error('Non-streaming API must not be used'); },
      stream: async (_id, _npcId, body, onToken) => {
        onToken('Movies are fun.');
        return { playerMessage: { id: globalThis.crypto.randomUUID(), sender: 'player', text: body.text, createdAt: new Date().toISOString() },
          npcMessage: { id: globalThis.crypto.randomUUID(), sender: 'npc', text: 'Movies are fun.', createdAt: new Date().toISOString(), ai: true },
          intent: null, misunderstood: false, correction: null, arrival, ai: true };
      } });
    await controller.start();
    assert.equal(await controller.send('Yes, movies sometimes'), true);
    assert.equal(controller.getSnapshot().announcement, 'Reply complete.');
  });
} finally {
  await server.close();
}
