import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom', ssr: { external: ['@life-abroad/shared'] } });
try {
  const { SavedConversation } = await server.ssrLoadModule('/src/features/dialogue/SavedConversation.tsx');
  const { ConversationOpeningIndicator } = await server.ssrLoadModule('/src/features/dialogue/ConversationOpeningIndicator.tsx');
  const arrival = { questId: 'q_station_arrival', status: 'active', currentStepId: 'arrival_ask', ticket: { issued: false, used: false }, canEnterTownStreet: false, locationId: 'loc_station', rewardsGranted: false };
  const state = { arrival, conversation: { id: 'test-session', npcId: 'npc_receptionist', messages: [] }, pending: false, error: '', retryMessage: { text: 'My unsent reply', clientMessageId: 'test-message' }, streaming: false, streamedReply: '', announcement: '' };
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
  test('conversation loading stays silent until it is ready and describes later sends', () => {
    const render = (pendingState) => renderToStaticMarkup(createElement(SavedConversation, {
      state: pendingState, online: true, sound: false, send: async () => true, retry: () => {},
    }));
    const opening = render({ ...state, conversation: null, pending: true, retryMessage: null });
    const sending = render({ ...state, pending: true });
    assert.doesNotMatch(opening, /Starting conversation…/);
    assert.match(sending, /Sending your reply…/);
    assert.doesNotMatch(`${opening}${sending}`, /server/i);
  });
  test('conversation startup gives immediate visual feedback without loading copy', () => {
    const html = renderToStaticMarkup(createElement(ConversationOpeningIndicator, {
      npcName: 'Mina', portrait: '/assets/mina.png',
    }));
    assert.match(html, /aria-label="Mina is about to speak\."/);
    assert.match(html, /animate-bounce/);
    assert.doesNotMatch(html, />Starting conversation/);
    assert.doesNotMatch(html, />Loading/);
  });
  test('composer stays visible but disabled while the NPC is responding', () => {
    const html = renderToStaticMarkup(createElement(SavedConversation, {
      state: { ...state, pending: true }, online: true, sound: false,
      send: async () => true, retry: () => {},
    }));
    assert.doesNotMatch(html, /invisible pointer-events-none/);
    assert.match(html, /<textarea[^>]*disabled/);
    assert.match(html, /Sending your reply/);
  });
  test('pending player messages render immediately and failed messages leave only the error', () => {
    const pending = renderToStaticMarkup(createElement(SavedConversation, {
      state: { ...state, pending: true }, online: true, sound: false, send: async () => true, retry: () => {},
    }));
    assert.match(pending, />My unsent reply</);
    const failed = renderToStaticMarkup(createElement(SavedConversation, {
      state: { ...state, pending: false, error: 'Message could not be sent.' }, online: true, sound: false,
      send: async () => false, retry: () => {},
    }));
    assert.doesNotMatch(failed, /<strong>You<\/strong>/);
    assert.match(failed, /<textarea[^>]*>My unsent reply<\/textarea>/);
    assert.match(failed, /Message could not be sent/);
  });
  test('conversation history receives the reclaimed vertical space', () => {
    const html = renderToStaticMarkup(createElement(SavedConversation, {
      state, online: true, sound: false, send: async () => true, retry: () => {},
    }));
    assert.match(html, /h-\[min\(320px,_40dvh\)\]/);
    assert.match(html, /max-h-\[min\(320px,_40dvh\)\]/);
  });
  test('T10f renders natural thinking and completion states without exposing AI', () => {
    const thinking = renderToStaticMarkup(createElement(SavedConversation, { state: { ...state, pending: true, streaming: true, streamedReply: '', retryMessage: null }, online: true, sound: false, send: async () => true, retry: () => {} }));
    assert.match(thinking, /Thinking…/);
    assert.doesNotMatch(thinking, /AI reply/);
    const typing = renderToStaticMarkup(createElement(SavedConversation, { state: { ...state, pending: true, streaming: true, streamedReply: 'A safe sentence.', retryMessage: { text: 'What movie?', clientMessageId: 'stream-message' } }, online: true, sound: false, send: async () => true, retry: () => {} }));
    assert.match(typing, /reveal-layout-reserve/);
    assert.doesNotMatch(typing, /animate-pulse/);
    assert.ok(typing.indexOf('What movie?') < typing.indexOf('A safe sentence.'));
    const aiMessage = { id: globalThis.crypto.randomUUID(), sender: 'npc', text: 'A short answer.', createdAt: new Date().toISOString(), ai: true };
    const complete = renderToStaticMarkup(createElement(SavedConversation, { state: { ...state, conversation: { ...state.conversation, messages: [aiMessage] }, retryMessage: null, announcement: 'Reply complete.', error: 'Free chat is available again tomorrow.' }, online: true, sound: false, send: async () => true, retry: () => {} }));
    assert.doesNotMatch(complete, />AI reply</i);
    assert.match(complete, /Reply complete/);
    assert.match(complete, /Free chat is available again tomorrow/);
    assert.doesNotMatch(complete, /AI test mode/);
  });
  test('conversation hints start behind an accessible disclosure button', () => {
    const html = renderToStaticMarkup(createElement(SavedConversation, { state: { ...state, retryMessage: null }, online: true, sound: false,
      send: async () => true, retry: () => {}, hint: 'Try asking about the weather, hobbies, food or life in Maplewood.' }));
    assert.match(html, /aria-label="Show conversation hint"/);
    assert.match(html, /aria-expanded="false"/);
    assert.doesNotMatch(html, /Try asking about the weather/);
  });
} finally { await server.close(); }
