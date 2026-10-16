import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', ssr: { external: ['@life-abroad/shared'] } });
try {
  const { SavedConversation } = await server.ssrLoadModule('/src/features/dialogue/SavedConversation.tsx');
  const arrival = { questId: 'q_station_arrival', status: 'active', currentStepId: 'arrival_ask', ticket: { issued: false, used: false }, canEnterTownStreet: false, locationId: 'loc_station', rewardsGranted: false };
  const state = { arrival, conversation: { id: 'test-session', npcId: 'npc_receptionist', messages: [] }, pending: false, error: '', correction: null, retryMessage: { text: 'My unsent reply', coach: true, clientMessageId: 'test-message' }, streaming: false, streamedReply: '', announcement: '' };
  // Going offline must preserve the retry draft and disable its composer, with no queued write.
  test('offline conversation keeps the draft visible, disables sending, and explains reconnection', () => {
    const html = renderToStaticMarkup(createElement(SavedConversation, { state, sound: false, online: false, send: async () => { throw new Error('Unexpected send'); }, retry: () => {} }));
    assert.match(html, /You’re offline/);
    assert.match(html, /nothing is queued/);
    assert.match(html, /<textarea[^>]*disabled[^>]*>My unsent reply<\/textarea>/);
    assert.match(html, /aria-label="Send" disabled/);
    assert.match(html, /Retry previous reply/);
  });
  test('finished arrival does not block shop chat; completed quests and closed sellers disable replies', () => {
    const done = { ...state, arrival: { ...arrival, status: 'done' }, retryMessage: null };
    const render = (props) => renderToStaticMarkup(createElement(SavedConversation, { state: done, online: true, sound: false, send: async () => true, retry: () => {}, ...props }));
    assert.doesNotMatch(render({}), /<textarea[^>]*disabled/);
    assert.match(render({ completed: true }), /<textarea[^>]*disabled/);
    assert.match(render({ state: { ...done, conversation: { ...done.conversation, seller: { closed: true } } } }), /<textarea[^>]*disabled/);
  });
  test('T10f renders thinking, confirmed AI labeling, completion announcement, and friendly limit errors', () => {
    const thinking = renderToStaticMarkup(createElement(SavedConversation, { state: { ...state, pending: true, streaming: true, streamedReply: '', retryMessage: null }, online: true, sound: false, send: async () => true, retry: () => {} }));
    assert.match(thinking, /Thinking…/);
    assert.doesNotMatch(thinking, /AI reply/);
    const aiMessage = { id: globalThis.crypto.randomUUID(), sender: 'npc', text: 'A short answer.', createdAt: new Date().toISOString(), ai: true };
    const complete = renderToStaticMarkup(createElement(SavedConversation, { state: { ...state, conversation: { ...state.conversation, messages: [aiMessage] }, retryMessage: null, announcement: 'AI reply complete.', error: 'Free chat is available again tomorrow.' }, online: true, sound: false, send: async () => true, retry: () => {} }));
    assert.match(complete, /AI reply/);
    assert.match(complete, /AI reply complete/);
    assert.match(complete, /Free chat is available again tomorrow/);
  });
} finally { await server.close(); }
