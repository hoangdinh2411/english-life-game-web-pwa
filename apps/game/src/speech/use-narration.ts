
import type { StationAudioCatalog, VoiceGender } from '../types/speech/narration';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createNarrator } from './narration';
import { createRecordedNarrator } from './recorded-narration';
import { TOWN_STREET_NPC_IDS } from '@life-abroad/shared';
function findClip(text: string, gender: VoiceGender, catalog: StationAudioCatalog): string | null {
  return catalog.find((clip) => clip.text === text && clip.gender === gender)?.asset ?? null;
}
export function useNarration(text: string, enabled: boolean, revision: string | number = text, gender: VoiceGender = 'male', npcId?: string, browserOnly = false) {
  const street = !browserOnly && (TOWN_STREET_NPC_IDS as readonly string[]).includes(npcId ?? '');
  const currentText = useRef(text); currentText.current = text;
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState('');
  const [playback, setPlayback] = useState<{ revision: string | number | null; progress: number }>({ revision: null, progress: 1 });
  const automaticRevision = useRef<string | number | null>(null);
  const [voicesReady, setVoicesReady] = useState(false);
  const [audioCatalog, setAudioCatalog] = useState<StationAudioCatalog | null>(null);
  const audioCatalogRef = useRef(audioCatalog);
  audioCatalogRef.current = audioCatalog;
  const lastRevision = useRef<string | number | null>(null);
  const browserVoice = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  const supported = typeof Audio !== 'undefined' && audioCatalog !== null;
  const narrationReady = audioCatalog !== null && (Boolean(findClip(text, gender, audioCatalog)) || !street && voicesReady);
  const narrator = useMemo(() => {
    const callbacks = { onSpeaking: setSpeaking, onError: (message: string) => { setError(message); },
      onProgress: (progress: number) => {
        const active = automaticRevision.current;
        if (active !== null) setPlayback(current => ({ revision: active,
          progress: current.revision === active ? Math.max(current.progress, progress) : progress }));
      } };
    const fallback = createNarrator(browserVoice ? window.speechSynthesis : null,
      (message) => new SpeechSynthesisUtterance(message), callbacks);
    // A missing/broken authored street clip must not silently switch the NPC
    // back to the browser voice. Player-written replay can still use TTS.
    const recordedFallback = street ? { ...fallback, speak: (message: string, voiceGender: VoiceGender = 'male') => {
      if (message === currentText.current || findClip(message, voiceGender, audioCatalogRef.current ?? [])) {
        setSpeaking(false); setError('This recording could not play. You can still read the dialogue; retry the speaker or reopen the conversation.');
      } else fallback.speak(message, voiceGender);
    } } : fallback;
    return createRecordedNarrator((message, voiceGender) => {
      const catalog = audioCatalogRef.current;
      return catalog ? findClip(message, voiceGender, catalog) : null;
    }, (url) => new Audio(url), recordedFallback, callbacks);
  }, [browserVoice, street]);
  useEffect(() => {
    let cancelled = false;
    setAudioCatalog(null);
    const loading = street ? import('../features/npcs/street-audio').then(module => module.loadStreetAudio())
      : import('./station-audio').then(({ stationAudio }) => stationAudio);
    void loading.then(catalog => {
      if (!cancelled) setAudioCatalog(catalog);
    }).catch(() => {
      if (!cancelled) { setAudioCatalog([]); setError(street ? 'Street recordings could not load. Reopen the conversation to retry. Text remains available.' : 'Recorded voices could not load. The browser voice may be used instead.'); }
    });
    return () => { cancelled = true; };
  }, [street]);
  useEffect(() => {
    if (!browserVoice || street) return;
    const synthesis = window.speechSynthesis;
    const update = () => setVoicesReady(synthesis.getVoices().some((voice) => voice.lang.toLowerCase().startsWith('en')));
    update();
    synthesis.addEventListener('voiceschanged', update);
    const timeout = setTimeout(() => {
      if (!findClip(text, gender, audioCatalogRef.current ?? []) && !synthesis.getVoices().some((voice) => voice.lang.toLowerCase().startsWith('en'))) setError('No English fallback voice is available yet. Text remains available.');
    }, 3000);
    return () => { clearTimeout(timeout); synthesis.removeEventListener('voiceschanged', update); };
  }, [browserVoice, street, text, gender]);
  useEffect(() => {
    if (!enabled) { narrator.stop(); return; }
    if (!narrationReady || lastRevision.current === revision) return;
    lastRevision.current = revision;
    automaticRevision.current = revision;
    setPlayback({ revision, progress: 0 });
    setError(''); narrator.speak(text, gender);
    const recorded = Boolean(findClip(text, gender, audioCatalogRef.current ?? []));
    const estimatedDuration = Math.min(8000, Math.max(1200, Array.from(text).length / 14 * 1000));
    const startedAt = Date.now();
    const timer = !recorded && !street ? window.setInterval(() => {
      const active = automaticRevision.current;
      if (active !== revision) return;
      const progress = Math.min(0.98, (Date.now() - startedAt) / estimatedDuration);
      setPlayback(current => current.revision === revision && progress > current.progress ? { revision, progress } : current);
    }, 80) : null;
    return () => { if (timer !== null) window.clearInterval(timer); narrator.stop(); };
  }, [text, enabled, revision, narrator, narrationReady, gender]);
  useEffect(() => () => { lastRevision.current = null; narrator.stop(); }, [narrator]);
  const stop = () => { automaticRevision.current = null; setPlayback(current => ({ ...current, progress: 1 })); narrator.stop(); };
  return { supported, speaking, error, ready: narrationReady, playback, stop, listen: (message: string = text) => {
    automaticRevision.current = null;
    setPlayback(current => ({ ...current, progress: 1 }));
    setError(''); if (enabled && audioCatalog !== null) narrator.speak(message, gender);
  } };
}
