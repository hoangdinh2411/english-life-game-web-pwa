// Uses real HUD/dialogue/narration components with explicitly fictional data.
// No authentication, API writes, or changes to the test account.
import { createRoot } from 'react-dom/client';
import { useEffect, useRef, useState } from 'react';
import { PlayerInfoCard } from '../src/gameplay/PlayerInfoCard';
import { Settings } from '../src/features/hud/Settings';
import { usePreferences } from '../src/features/hud/usePreferences';
import { SavedConversation } from '../src/features/dialogue/SavedConversation';
import { useNarration } from '../src/speech/use-narration';
import { tutorialText } from '../src/speech/tutorial-text';
import type { ConversationSnapshot } from '../src/features/dialogue/conversation-controller';
import '../src/styles.css';

const state: ConversationSnapshot = {
  arrival: null, conversation: null, pending: false, error: '', retryMessage: null,
  correction: { original: 'I new here', improved: 'I am new here.', reason: 'Use am after I.', question: 'you are new here' },
};
function HudFixture() {
  const { sound } = usePreferences();
  const [zoom, setZoom] = useState(false);
  const [profile, setProfile] = useState(false);
  const preview = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!zoom || !preview.current) return;
    // Simulate text-only zoom: double each original computed font, retaining
    // the viewport and geometry so fixed-width clipping is exposed.
    const entries = Array.from(preview.current.querySelectorAll<HTMLElement>('h1,h2,h3,p,span,strong,button,textarea')).map(element => {
      const style = getComputedStyle(element);
      return { element, originalSize: element.style.fontSize, originalLine: element.style.lineHeight,
        size: parseFloat(style.fontSize) * 2, line: parseFloat(style.lineHeight) * 2 };
    });
    entries.forEach(({ element, size, line }) => { element.style.fontSize = `${size}px`; if (Number.isFinite(line)) element.style.lineHeight = `${line}px`; });
    return () => entries.forEach(({ element, originalSize, originalLine }) => { element.style.fontSize = originalSize; element.style.lineHeight = originalLine; });
  }, [zoom]);
  const voice = useNarration(tutorialText, sound, 'hud-fixture');
  return <main ref={preview} className="min-h-dvh bg-paper p-2">
    <h1 className="text-base">Fictional HUD preview · no account changes</h1>
    <PlayerInfoCard playerName="Alexandria Montgomery Williams" coins={99999} cityName="Maplewood" savedTime={new Date('2026-10-10T15:46:00Z')} onOpenProfile={() => setProfile(value => !value)} />
    {profile ? <p>Alexandria Montgomery Williams · $99,999 · Maplewood</p> : null}
    <button type="button" onClick={() => setZoom(value => !value)}>Text zoom 200%</button>
    <Settings />
    <button type="button" onClick={() => voice.listen()}>Play narration</button>
    <p role="status">Narration {voice.speaking ? 'playing' : 'stopped'}</p>
    <SavedConversation state={state} sound={sound} online={false} send={async () => false} retry={() => {}} />
  </main>;
}
const root = document.getElementById('root');
if (!root) throw new Error('HUD fixture root is missing');
createRoot(root).render(<HudFixture />);
