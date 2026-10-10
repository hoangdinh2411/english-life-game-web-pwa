import type { NarrationCallbacks, Narrator, RecordedAudio, RecordedNarrator, VoiceGender } from '../types/speech/narration';

export function createRecordedNarrator(findClip: (text: string, gender: VoiceGender) => string | null, createAudio: (url: string) => RecordedAudio, fallback: Narrator, callbacks: NarrationCallbacks): RecordedNarrator {
  let current: RecordedAudio | null = null;
  let version = 0;
  const stop = () => {
    version++;
    if (current) { current.onended = null; current.onerror = null; current.pause(); current.currentTime = 0; current = null; }
    fallback.stop(); callbacks.onSpeaking(false);
  };
  return {
    stop,
    speak(text, gender = 'male') {
      stop();
      const url = findClip(text, gender);
      if (!url) { fallback.speak(text, gender); return; }
      const audio = createAudio(url);
      const request = version;
      current = audio;
      audio.onended = () => { if (request === version) { current = null; callbacks.onSpeaking(false); } };
      audio.onerror = () => { if (request === version) { stop(); fallback.speak(text, gender); } };
      void audio.play().then(() => { if (request === version) callbacks.onSpeaking(true); }).catch(() => {
        if (request !== version) return;
        stop(); callbacks.onError('Tap a speaker icon to enable voice playback.');
      });
    },
  };
}
