import type { SpeechWindow } from '../types/speech/recognition';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createSpeechInput } from './speech-input';
export function useSpeech(onTranscript: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const callback = useRef(onTranscript);
  callback.current = onTranscript;
  const constructor = typeof window === 'undefined' ? undefined : (window as unknown as SpeechWindow).SpeechRecognition ?? (window as unknown as SpeechWindow).webkitSpeechRecognition;
  const input = useMemo(() => createSpeechInput(() => constructor ? new constructor() : null, {
    onListening: setListening, onInterim: setInterim, onError: setError, onTranscript: (text) => callback.current(text),
  }), [constructor]);
  useEffect(() => () => input.stop(), [input]);
  return { supported: Boolean(constructor), listening, interim, error, start: () => { setError(''); input.start(); }, stop: input.stop, finish: input.finish };
}
