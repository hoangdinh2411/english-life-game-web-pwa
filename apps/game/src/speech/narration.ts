import type { NarrationCallbacks, Narrator, Synthesis, Utterance } from '../types/speech/narration';

export function createNarrator(synthesis: Synthesis | null, createUtterance: (text: string) => Utterance, callbacks: NarrationCallbacks): Narrator {
  let current: Utterance | null = null;
  const stop = () => {
    if (current) { current.onstart = null; current.onend = null; current.onerror = null; current = null; synthesis?.cancel(); }
    callbacks.onSpeaking(false);
  };
  return {
    stop,
    speak(text) {
      stop();
      if (!synthesis || !text.trim()) return;
      const utterance = createUtterance(text);
      utterance.lang = 'en-US'; utterance.rate = 0.9; utterance.pitch = 1; utterance.volume = 1;
      const voice = synthesis.getVoices().find((candidate) => candidate.lang.toLowerCase().startsWith('en'));
      if (voice) utterance.voice = voice;
      current = utterance;
      utterance.onstart = () => { if (current === utterance) callbacks.onSpeaking(true); };
      utterance.onend = () => { if (current === utterance) { current = null; callbacks.onSpeaking(false); } };
      utterance.onerror = () => {
        if (current !== utterance) return;
        current = null; callbacks.onSpeaking(false);
        callbacks.onError('Your browser paused automatic audio. Tap a speaker icon once to enable playback.');
      };
      try { synthesis.speak(utterance); }
      catch { current = null; callbacks.onSpeaking(false); callbacks.onError('Voice playback is unavailable. You can still read the dialogue.'); }
    },
  };
}
