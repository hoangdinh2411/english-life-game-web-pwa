import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecordedNarrator } from '../src/speech/recorded-narration.ts';

test('recordings select male/female voices and cancel previous playback', async () => {
  const created = [], state = [], fallback = [];
  const narrator = createRecordedNarrator((text, gender) => text === 'Hello' ? `${gender}.wav` : null, (url) => {
    const audio = { url, currentTime: 0, pauseCount: 0, play: async () => {}, pause() { this.pauseCount++; } };
    created.push(audio); return audio;
  }, { speak: (text) => fallback.push(text), stop: () => {} }, { onSpeaking: (value) => state.push(value), onError: () => assert.fail('unexpected error') });
  narrator.speak('Hello', 'female'); await Promise.resolve();
  const lateEnd = created[0].onended;
  narrator.speak('Hello', 'male'); await Promise.resolve(); lateEnd();
  assert.equal(created[0].url, 'female.wav'); assert.equal(created[1].url, 'male.wav');
  assert.equal(created[0].pauseCount, 1); assert.equal(state.at(-1), true);
  narrator.speak('New text'); assert.deepEqual(fallback, ['New text']);
  narrator.stop(); assert.equal(state.at(-1), false);
});

test('blocked audio remains readable and late playback cannot restart a stopped narrator', async () => {
  const state = [], errors = [];
  let resolvePlay;
  const narrator = createRecordedNarrator(() => 'voice.wav', () => ({ currentTime: 0, pause() {}, play: () => new Promise((resolve) => { resolvePlay = resolve; }) }), { speak() {}, stop() {} }, { onSpeaking: (value) => state.push(value), onError: (error) => errors.push(error) });
  narrator.speak('Hello'); narrator.stop(); resolvePlay(); await Promise.resolve();
  assert.equal(state.at(-1), false);
  const blocked = createRecordedNarrator(() => 'voice.wav', () => ({ currentTime: 0, pause() {}, play: async () => { throw new Error('autoplay blocked'); } }), { speak() {}, stop() {} }, { onSpeaking() {}, onError: (error) => errors.push(error) });
  blocked.speak('Hello'); await Promise.resolve(); await Promise.resolve();
  assert.match(errors[0], /speaker icon/);
});
