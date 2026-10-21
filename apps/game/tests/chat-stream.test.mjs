import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', ssr: { external: ['@life-abroad/shared'] } });

try {
  const { readChatStream } = await server.ssrLoadModule('/src/features/dialogue/chat-stream.ts');

  test('T10f parses split SSE chunks, exposes words immediately, and returns the completed turn', async () => {
    const turn = { playerMessage: { id: globalThis.crypto.randomUUID(), sender: 'player', text: 'Hello', createdAt: new Date().toISOString() },
      npcMessage: { id: globalThis.crypto.randomUUID(), sender: 'npc', text: 'Hi there.', createdAt: new Date().toISOString(), ai: true },
      intent: null, misunderstood: false,
      arrival: { questId: 'q_station_arrival', status: 'active', currentStepId: null, ticket: { issued: false, used: false }, canEnterTownStreet: false, locationId: 'loc_station', rewardsGranted: false }, ai: true };
    const chunks = ['event: token\ndata: {"text":"Hi "}\n\nev', 'ent: token\ndata: {"text":"there."}\n\nevent: done\ndata: ', `${JSON.stringify({ turn })}\n\n`];
    const response = new globalThis.Response(new globalThis.ReadableStream({ start(controller) { for (const chunk of chunks) controller.enqueue(new globalThis.TextEncoder().encode(chunk)); controller.close(); } }),
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    const words = [];
    const result = await readChatStream(response, word => words.push(word));
    assert.deepEqual(words, ['Hi ', 'there.']);
    assert.deepEqual(result, turn);
  });

  test('T10f surfaces a streamed limit/error message with a useful retry action', async () => {
    const response = new globalThis.Response('event: error\ndata: {"message":"Free chat is available again tomorrow."}\n\n',
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    await assert.rejects(readChatStream(response, () => {}), /Free chat is available again tomorrow/);
  });
} finally { await server.close(); }
