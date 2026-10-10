import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', ssr: { external: ['@life-abroad/shared'] } });
try {
  const { ArrivalConversation } = await server.ssrLoadModule('/src/features/station/ArrivalConversation.tsx');
  const arrival = { questId: 'q_station_arrival', status: 'active', currentStepId: 'arrival_ask', ticket: { issued: false, used: false }, canEnterTownStreet: false, locationId: 'loc_station', rewardsGranted: false };
  const state = { arrival, conversation: { id: 'test-session', npcId: 'npc_receptionist', messages: [] }, pending: false, error: '', correction: null, retryMessage: { text: 'My unsent reply', coach: true, clientMessageId: 'test-message' } };
  // Going offline must preserve the retry draft and disable its composer, with no queued write.
  test('offline conversation keeps the draft visible, disables sending, and explains reconnection', () => {
    const html = renderToStaticMarkup(createElement(ArrivalConversation, { state, sound: false, online: false, send: async () => { throw new Error('Unexpected send'); }, retry: () => {} }));
    assert.match(html, /You’re offline/);
    assert.match(html, /nothing is queued/);
    assert.match(html, /<textarea[^>]*disabled[^>]*>My unsent reply<\/textarea>/);
    assert.match(html, /aria-label="Send" disabled/);
    assert.match(html, /Retry previous reply/);
  });
} finally { await server.close(); }
