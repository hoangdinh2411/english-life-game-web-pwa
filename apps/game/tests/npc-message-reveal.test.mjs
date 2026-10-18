import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { textAtProgress, selectAutomaticReveal, shouldUseTypingFallback } from '../src/features/dialogue/use-npc-message-reveal.ts';
import { DialogueMessage } from '../src/gameplay/DialogueMessage.tsx';

test('restored history stays complete and only a newly observed NPC message is selected', () => {
  const restored = { id: 'old', text: 'Welcome back.', npc: true };
  const initial = selectAutomaticReveal(undefined, null, restored);
  assert.equal(initial.active, null);
  const player = selectAutomaticReveal(initial.observedId, initial.active, { id: 'player', text: 'Hello', npc: false });
  assert.equal(player.active, null);
  const reply = { id: 'reply', text: 'It is good to see you.', npc: true };
  assert.deepEqual(selectAutomaticReveal(player.observedId, player.active, reply).active, reply);
});

test('progress reveals Unicode-safe text and clamps completion', () => {
  assert.equal(textAtProgress('Hi 👋', 0), '');
  assert.equal(textAtProgress('abcdefghij', 0.5), 'abcdefg');
  assert.equal(textAtProgress('Hi 👋', 0.8), 'Hi 👋');
  assert.equal(textAtProgress('Hi 👋', 2), 'Hi 👋');
});

test('missing narration uses typing instead of leaving a new NPC message blank', () => {
  assert.equal(shouldUseTypingFallback(true, false, ''), true);
  assert.equal(shouldUseTypingFallback(true, true, ''), false);
  assert.equal(shouldUseTypingFallback(true, true, 'Playback failed'), true);
});

test('animated text exposes the full sentence once to assistive technology', () => {
  const html = renderToStaticMarkup(createElement(DialogueMessage, {
    name: 'Mia', portrait: '/mia.png', text: 'Hello', fullText: 'Hello there', revealing: true,
  }));
  assert.match(html, /class="sr-only">Hello there/);
  assert.match(html, /aria-hidden="true">Hello/);
  assert.match(html, /animate-pulse/);
  assert.match(html, />Typing…</);
  const complete = renderToStaticMarkup(createElement(DialogueMessage, {
    name: 'Mia', portrait: '/mia.png', text: 'Hello there', revealing: false,
  }));
  assert.doesNotMatch(complete, />Typing…</);
});

test('speaker control keeps a fixed layout slot when speech is hidden', () => {
  const visible = renderToStaticMarkup(createElement(DialogueMessage, {
    name: 'Raj', portrait: '/raj.png', text: 'Hello.', onReplay: () => {}, replayVisible: true,
  }));
  const hidden = renderToStaticMarkup(createElement(DialogueMessage, {
    name: 'Raj', portrait: '/raj.png', text: 'Hello.', onReplay: () => {}, replayVisible: false,
  }));
  assert.match(visible, /speaker-control-slot/);
  assert.match(hidden, /speaker-control-slot[^"].*invisible|invisible[^"].*speaker-control-slot/);
  assert.doesNotMatch(hidden, /<button/);
});
