import test from 'node:test';
import assert from 'node:assert/strict';
import { createNarrator } from '../src/speech/narration.ts';

const normalPlayback = () => ({ speechRate: 1, speechPitch: 1 });

test('a male NPC never falls back to an explicitly female voice', () => {
  const errors = [];
  const narrator = createNarrator({ getVoices: () => [{ name: 'Microsoft Zira', lang: 'en-US' }], cancel: () => {}, speak: () => assert.fail('Wrong gender spoken') },
    text => ({ text }), { onSpeaking: () => {}, onError: text => errors.push(text) }, normalPlayback);
  narrator.speak('Welcome to the shop', 'male');
  assert.match(errors[0], /male voice is unavailable/);
});
test('narration selects English, replaces previous speech and cancels on close', () => {
  const spoken = [], state = [];
  let cancelled = 0;
  const narrator = createNarrator({ getVoices: () => [{ lang: 'sv-SE' }, { lang: 'en-GB' }], speak: (utterance) => { spoken.push(utterance); utterance.onstart(); }, cancel: () => cancelled++ }, (text) => ({ text }), { onSpeaking: (value) => state.push(value), onError: () => assert.fail('unexpected error') }, normalPlayback);
  narrator.speak('Welcome');
  assert.equal(spoken[0].voice.lang, 'en-GB');
  assert.equal(spoken[0].volume, 1);
  const late = spoken[0].onend;
  narrator.speak('Next reply'); late();
  assert.equal(state.at(-1), true);
  narrator.stop(); assert.equal(cancelled, 2); assert.equal(state.at(-1), false);
});
test('unavailable or blocked narration preserves readable dialogue', () => {
  const errors = [];
  const callbacks = { onSpeaking: () => {}, onError: (message) => errors.push(message) };
  createNarrator(null, () => assert.fail('no voice available'), callbacks, normalPlayback).speak('Hello');
  createNarrator({ getVoices: () => [], cancel: () => {}, speak: () => { throw new Error('blocked'); } }, (text) => ({ text }), callbacks, normalPlayback).speak('Hello');
  assert.match(errors[0], /read/);
});

test('browser narration reports text progress from word boundaries and completion', () => {
  const progress = [];
  let utterance;
  const narrator = createNarrator({ getVoices: () => [{ name: 'English Voice', lang: 'en-US' }], cancel() {}, speak: value => { utterance = value; } },
    text => ({ text }), { onSpeaking() {}, onError() {}, onProgress: value => progress.push(value) }, normalPlayback);
  narrator.speak('Hello world');
  utterance.onstart();
  utterance.onboundary({ charIndex: 6 });
  utterance.onend();
  assert.deepEqual(progress, [0, 6 / 11, 1]);
});

test('browser narration applies speed and pitch independently', () => {
  let utterance;
  const narrator = createNarrator(
    { getVoices: () => [{ name: 'Microsoft David Desktop', lang: 'en-US' }], cancel() {}, speak: value => { utterance = value; } },
    text => ({ text }),
    { onSpeaking() {}, onError: () => assert.fail('unexpected error') },
    () => ({ speechRate: 1.3, speechPitch: 0.8 }),
  );
  narrator.speak('Slower or lower', 'male');
  assert.equal(utterance.rate, 1.3);
  assert.equal(utterance.pitch, 0.8);
});
