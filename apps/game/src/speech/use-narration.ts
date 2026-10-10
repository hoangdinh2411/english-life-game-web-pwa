
import type { StationAudioCatalog, VoiceGender } from '../types/speech/narration';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createNarrator } from './narration';
import { createRecordedNarrator } from './recorded-narration';
function findClip(text: string, gender: VoiceGender, catalog: StationAudioCatalog): string | null {
  return catalog.find((clip) => clip.text === text && clip.gender === gender)?.asset ?? null;
}
export function useNarration(text: string, enabled: boolean, revision: string | number = text, gender: VoiceGender = 'male') {
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState('');
  const [voicesReady, setVoicesReady] = useState(false);
  const [audioCatalog, setAudioCatalog] = useState<StationAudioCatalog | null>(null);
  const audioCatalogRef = useRef(audioCatalog);
  audioCatalogRef.current = audioCatalog;
  const lastRevision = useRef<string | number | null>(null);
  const browserVoice = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  const supported = typeof Audio !== 'undefined' && audioCatalog !== null;
  const narrationReady = audioCatalog !== null && (Boolean(findClip(text, gender, audioCatalog)) || voicesReady);
  const narrator = useMemo(() => {
    const fallback = createNarrator(browserVoice ? window.speechSynthesis : null,
    (message) => new SpeechSynthesisUtterance(message),
    { onSpeaking: setSpeaking, onError: setError });
    return createRecordedNarrator((message, voiceGender) => {
      const catalog = audioCatalogRef.current;
      return catalog ? findClip(message, voiceGender, catalog) : null;
    }, (url) => new Audio(url), fallback, { onSpeaking: setSpeaking, onError: setError });
  }, [browserVoice]);
  useEffect(() => {
    let cancelled = false;
    void import('./station-audio').then(({ stationAudio }) => {
      if (!cancelled) setAudioCatalog(stationAudio);
    }).catch(() => {
      if (!cancelled) { setAudioCatalog([]); setError('Recorded voices could not load. The browser voice may be used instead.'); }
    });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!browserVoice) return;
    const synthesis = window.speechSynthesis;
    const update = () => setVoicesReady(synthesis.getVoices().some((voice) => voice.lang.toLowerCase().startsWith('en')));
    update();
    synthesis.addEventListener('voiceschanged', update);
    const timeout = setTimeout(() => {
      if (!findClip(text, gender, audioCatalogRef.current ?? []) && !synthesis.getVoices().some((voice) => voice.lang.toLowerCase().startsWith('en'))) setError('No English fallback voice is available yet. Text remains available.');
    }, 3000);
    return () => { clearTimeout(timeout); synthesis.removeEventListener('voiceschanged', update); };
  }, [browserVoice, text, gender]);
  useEffect(() => {
    if (!enabled) { narrator.stop(); return; }
    if (!narrationReady || lastRevision.current === revision) return;
    lastRevision.current = revision;
    setError(''); narrator.speak(text, gender);
    return () => narrator.stop();
  }, [text, enabled, revision, narrator, narrationReady, gender]);
  useEffect(() => () => { lastRevision.current = null; narrator.stop(); }, [narrator]);
  return { supported, speaking, error, stop: narrator.stop, listen: (message: string = text) => { setError(''); if (enabled && audioCatalog !== null) narrator.speak(message, gender); } };
}
