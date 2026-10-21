import assert from 'node:assert/strict';
import test from 'node:test';
import { createCorsAudioElement, createProcessedAudio } from '../src/speech/processed-audio.ts';

test('signed speech enables anonymous CORS before assigning its URL', () => {
  const operations = [];
  const audio = {
    set crossOrigin(value) { operations.push(['crossOrigin', value]); },
    set src(value) { operations.push(['src', value]); },
  };

  assert.equal(createCorsAudioElement('https://storage.test/signed/audio.mp3', () => audio), audio);
  assert.deepEqual(operations, [
    ['crossOrigin', 'anonymous'],
    ['src', 'https://storage.test/signed/audio.mp3'],
  ]);
});

test('AudioWorklet setup failure falls back to ordinary bounded-rate playback', async () => {
  const OriginalAudio = globalThis.Audio;
  const played = [];
  class FakeAudio {
    currentTime = 0;
    duration = 1;
    playbackRate = 1;
    preservesPitch = false;
    onended = null;
    onerror = null;
    ontimeupdate = null;
    pause() {}
    async play() { played.push({ playbackRate: this.playbackRate, preservesPitch: this.preservesPitch }); }
  }
  globalThis.Audio = FakeAudio;
  try {
    const audio = createProcessedAudio('https://storage.test/signed/audio.mp3', {
      speechRate: 1.5,
      speechPitch: 0.75,
    });
    await audio.play();
    assert.deepEqual(played, [{ playbackRate: 1.5, preservesPitch: true }]);
  } finally {
    if (OriginalAudio) globalThis.Audio = OriginalAudio;
    else delete globalThis.Audio;
  }
});
