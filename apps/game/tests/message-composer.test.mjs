import assert from 'node:assert/strict';
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
