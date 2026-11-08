import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MessageComposer } from '../src/gameplay/MessageComposer.tsx';

const renderComposer = (listening) => renderToStaticMarkup(createElement(MessageComposer, {
  text: 'My draft',
  onChange() {},
  onSend() {},
  onRecord() {},
  onCancelRecording() {},
  voiceSupported: true,
  listening,
  pending: false,
}));

test('recording replaces the editable reply with an accessible audio waveform', () => {
  const recording = renderComposer(true);
  assert.match(recording, /data-testid="audio-waveform"/);
  assert.match(recording, /role="status"/);
  assert.match(recording, /Listening…/);
  assert.doesNotMatch(recording, /<textarea/);
  assert.match(recording, /aria-label="Stop recording"/);
  assert.match(recording, /aria-label="Cancel recording and clear transcript"/);

  const idle = renderComposer(false);
  assert.match(idle, /<textarea[^>]*aria-label="Your English reply"/);
  assert.doesNotMatch(idle, /data-testid="audio-waveform"/);
});

test('composer stays visually compact without shrinking its touch targets', () => {
  const html = renderComposer(false);
  assert.match(html, /<textarea[^>]*rows="1"/);
  assert.match(html, /message-composer[^>]*gap-0\.5[^>]*p-1/);
  assert.equal((html.match(/size-11/g) ?? []).length, 2);
  assert.doesNotMatch(html, /focus-within/);
});

test('conversation history hides its scrollbar without disabling scrolling', () => {
  const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.conversation-history\s*\{[^}]*scrollbar-width:\s*none/s);
  assert.match(css, /\.conversation-history::-webkit-scrollbar\s*\{[^}]*display:\s*none/s);
});
