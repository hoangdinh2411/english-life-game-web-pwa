import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecordedNarrator } from '../src/speech/recorded-narration.ts';
import { createNarrator } from '../src/speech/narration.ts';

test('browser fallback chooses a matching English voice when available', () => {
  const voices = [
    { name: 'Microsoft David Desktop', lang: 'en-US' },
    { name: 'Microsoft Zira Desktop', lang: 'en-US' },
  ];
  const spoken = [];
  const narrator = createNarrator({ getVoices: () => voices, speak: (utterance) => spoken.push(utterance), cancel() {} },
    (text) => ({ text }), { onSpeaking() {}, onError() {} });

  narrator.speak('Welcome', 'female');
  assert.equal(spoken[0].voice.name, 'Microsoft Zira Desktop');
});

test('female browser fallback avoids a known male voice when an unlabelled English voice is available', () => {
  const voices = [
    { name: 'Microsoft David Desktop', lang: 'en-US' },
    { name: 'English Voice', lang: 'en-GB' },
  ];
  const spoken = [];
  const narrator = createNarrator({ getVoices: () => voices, speak: (utterance) => spoken.push(utterance), cancel() {} },
    (text) => ({ text }), { onSpeaking() {}, onError() {} });

  narrator.speak('I’m not sure about that yet. Could you ask me something else?', 'female');
  assert.equal(spoken[0].voice.name, 'English Voice');
  assert.equal(spoken[0].pitch, 1.18);
});

test('recordings select male/female voices and cancel previous playback', async () => {
  const created = [], state = [], fallback = [];
  const narrator = createRecordedNarrator((text, gender) => text === 'Hello' ? `${gender}.wav` : null, (url) => {
    const audio = { url, currentTime: 0, pauseCount: 0, play: async () => {}, pause() { this.pauseCount++; } };
    created.push(audio); return audio;
  }, { speak: (text, gender) => fallback.push({ text, gender }), stop: () => {} }, { onSpeaking: (value) => state.push(value), onError: () => assert.fail('unexpected error') });
  narrator.speak('Hello', 'female'); await Promise.resolve();
  const lateEnd = created[0].onended;
  narrator.speak('Hello', 'male'); await Promise.resolve(); lateEnd();
  assert.equal(created[0].url, 'female.wav'); assert.equal(created[1].url, 'male.wav');
  assert.equal(created[0].pauseCount, 1); assert.equal(state.at(-1), true);
  narrator.speak('New text', 'female'); assert.deepEqual(fallback, [{ text: 'New text', gender: 'female' }]);
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
