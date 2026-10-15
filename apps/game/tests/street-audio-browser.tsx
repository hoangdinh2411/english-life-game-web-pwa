// Audit the real hook and real downloaded MP3, without writing account data.
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useNarration } from '../src/speech/use-narration';
import '../src/styles.css';

let recordAudio: ((url: string) => void) | undefined;
let recordFallback: (() => void) | undefined;
let failPlayback = false;
const NativeAudio = window.Audio;
window.Audio = class extends NativeAudio {
  constructor(source?: string) {
    super(failPlayback ? '/__missing-street-recording.mp3' : source);
    recordAudio?.(source ?? '');
  }
};
if ('speechSynthesis' in window) window.speechSynthesis.speak = () => { recordFallback?.(); };

function VoiceFixture() {
  const [source, setSource] = useState('');
  const [fallbacks, setFallbacks] = useState(0);
  const [male, setMale] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const voice = useNarration('Good day! Do you like exploring new places?', enabled,
    male ? 'male' : 'female', male ? 'male' : 'female', male ? 'npc_amir_courier' : 'npc_maya_teacher');
  useEffect(() => {
    recordAudio = setSource; recordFallback = () => setFallbacks(value => value + 1);
    return () => { recordAudio = undefined; recordFallback = undefined; };
  }, []);
  return <main style={{ padding: 16, overflowWrap: 'anywhere' }}>
    <h1>Street recording audit · no account changes</h1>
    <p>Voice: {male ? 'male' : 'female'}</p>
    <button type="button" onClick={() => { setEnabled(true); voice.listen(); }}>Play street recording</button>
    <button type="button" onClick={() => setEnabled(false)}>Mute</button>
    <button type="button" onClick={() => { setEnabled(false); setMale(value => !value); }}>Switch NPC voice</button>
    <button type="button" onClick={() => { failPlayback = true; voice.listen(); }}>Simulate missing recording</button>
    <p role="status">Playback: {voice.speaking ? 'playing' : 'stopped'}</p>
    <p>Recording URL: {source}</p>
    <p>Browser fallback calls: {fallbacks}</p>
    {voice.error ? <p role="alert">{voice.error}</p> : null}
  </main>;
}
const root = document.getElementById('root');
if (!root) throw new Error('Voice fixture root is missing');
createRoot(root).render(<VoiceFixture />);
