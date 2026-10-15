import type { NarrationCallbacks, Narrator, Synthesis, Utterance, VoiceGender } from '../types/speech/narration';

const voiceNames: Record<VoiceGender, RegExp> = {
  female: /\b(?:female|zira|aria|jenny|samantha|susan|karen|ava|allison|siri|eva|heera|hazel|sonia|libby|natasha|michelle|monica|catherine|emma|moira|tessa|fiona)\b/i,
  male: /\b(?:male|david|mark|guy|daniel|alex|tom|christopher|ryan|eric|andrew|roger|thomas|george|steffan|fred)\b/i,
};

export function createNarrator(synthesis: Synthesis | null, createUtterance: (text: string) => Utterance, callbacks: NarrationCallbacks): Narrator {
  let current: Utterance | null = null;
  const stop = () => {
    if (current) { current.onstart = null; current.onend = null; current.onerror = null; current.onboundary = null; current = null; synthesis?.cancel(); }
    callbacks.onSpeaking(false);
  };
  return {
    stop,
    speak(text, gender = 'female') {
      stop();
      if (!synthesis || !text.trim()) return;
      const utterance = createUtterance(text);
      utterance.lang = 'en-US'; utterance.rate = 0.9; utterance.pitch = 1; utterance.volume = 1;
      const englishVoices = synthesis.getVoices().filter((candidate) => candidate.lang.toLowerCase().startsWith('en'));
      const voice = englishVoices.find((candidate) => voiceNames[gender].test(candidate.name)) ??
        englishVoices.find((candidate) => !voiceNames[gender === 'female' ? 'male' : 'female'].test(candidate.name));
      if (!voice) {
        callbacks.onError(`An English ${gender} voice is unavailable. You can still read the dialogue.`);
        return;
      }
      // Browser voice names are inconsistent. A slight pitch lift helps when
      // the browser exposes no identifiable female voice for a female speaker.
      if (gender === 'female' && voice && !voiceNames.female.test(voice.name)) utterance.pitch = 1.18;
      if (voice) utterance.voice = voice;
      current = utterance;
      callbacks.onProgress?.(0);
      utterance.onstart = () => { if (current === utterance) callbacks.onSpeaking(true); };
      utterance.onboundary = (event) => { if (current === utterance) callbacks.onProgress?.(Math.min(1, event.charIndex / text.length)); };
      utterance.onend = () => { if (current === utterance) { callbacks.onProgress?.(1); current = null; callbacks.onSpeaking(false); } };
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
