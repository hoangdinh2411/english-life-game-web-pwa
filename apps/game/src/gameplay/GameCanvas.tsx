
import { useEffect, useRef, useState } from 'react';
import { GameButton } from './GameButton';
import { useWindowDimensions } from '../hooks/use-window-size';
import type { GameCanvasProps, StationGame } from '../types/gameplay/world';
import { SHOP_NPCS } from '../features/shops/shop-npcs';
import { STATION_NPCS } from './station-navigation';
export default function GameCanvas({ paused, exitUnlocked, onExitBlocked, onTalk, onReadyChange, onLocationChange, initialLocation = 'station', onEnterStreet, appearance, getGameTime, onStoreClosed }: GameCanvasProps) {
  const { width } = useWindowDimensions();
  const parent = useRef<HTMLDivElement>(null);
  const game = useRef<StationGame | null>(null);
  const callbacks = useRef({ onTalk, onLocationChange, onExitBlocked, onReadyChange, onEnterStreet, getGameTime, onStoreClosed });
  callbacks.current = { onTalk, onLocationChange, onExitBlocked, onReadyChange, onEnterStreet, getGameTime, onStoreClosed };
  const pausedRef = useRef(paused); pausedRef.current = paused;
  const exitRef = useRef(exitUnlocked); exitRef.current = exitUnlocked;
  const appearanceRef = useRef(appearance); appearanceRef.current = appearance;
  useEffect(() => { game.current?.setAppearance(appearance); }, [appearance]);
  const [nearby, setNearby] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [locationLabel, setLocationLabel] = useState(initialLocation === 'street' ? 'Maplewood Town Street' : 'Maplewood train station');
  const [attempt, setAttempt] = useState(0);
  const [progress, setProgress] = useState(0);
  const serverExit = Boolean(onEnterStreet);
  useEffect(() => {
    let cancelled = false;
    let instance: StationGame | null = null;
    const host = document.createElement('div');
    host.className = "phaser-host w-full h-full overflow-hidden bg-[#241f19] touch-none";
    parent.current?.append(host);
    setReady(false); setError(''); setNearby(null);
    callbacks.current.onReadyChange(false);
    const start = async () => {
      const { createStationGame } = await import('./create-station-game');
      if (cancelled) return;
      instance = createStationGame(host, {
        initialLocation,
        appearance: appearanceRef.current,
        practice: !serverExit,
        onProgress: (value) => { if (!cancelled) setProgress(value); },
        ...(serverExit ? { onEnterStreet: () => callbacks.current.onEnterStreet?.() ?? Promise.resolve(false) } : {}),
        ...(serverExit ? {
          getGameTime: () => callbacks.current.getGameTime?.() ?? null,
          onStoreClosed: (location) => callbacks.current.onStoreClosed?.(location),
        } : {}),
        onNearby: (id) => { if (!cancelled) setNearby(id); },
        onTalk: (id) => { if (!cancelled) callbacks.current.onTalk(id); },
        onReady: () => { if (!cancelled) { setReady(true); callbacks.current.onReadyChange(true); } },
        onLocationChange: (location) => { if (!cancelled) { setLocationLabel(location); setNearby(null); setReady(false); callbacks.current.onReadyChange(false); callbacks.current.onLocationChange(location); } },
        onError: (message) => { if (!cancelled) { setError(message); callbacks.current.onReadyChange(false); } },
        onExitBlocked: () => { if (!cancelled) callbacks.current.onExitBlocked(); },
      });
      game.current = instance;
      instance.pause(pausedRef.current || document.hidden);
      instance.unlockExit(exitRef.current);
    };
    const visibility = () => instance?.pause(pausedRef.current || document.hidden);
    document.addEventListener('visibilitychange', visibility);
    void start().catch((failure: unknown) => {
      if (!cancelled) { setError(`The station could not start. ${failure instanceof Error ? failure.message : 'Please retry.'}`); callbacks.current.onReadyChange(false); }
    });
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', visibility);
      instance?.destroy();
      if (game.current === instance) game.current = null;
      host.remove();
    };
  }, [attempt, initialLocation, serverExit]);
  useEffect(() => { game.current?.pause(paused || document.hidden); }, [paused]);
  useEffect(() => { game.current?.unlockExit(exitUnlocked); }, [exitUnlocked]);
  const npc = [...STATION_NPCS, ...SHOP_NPCS].find((item) => item.id === nearby);
  return <div className="game-canvas absolute inset-0">
    <div ref={parent} className="canvas-parent absolute inset-0 w-full h-full overflow-hidden bg-[#241f19] touch-none" role="img" aria-label={`${locationLabel}. Tap the path to walk, or use arrow keys or WASD. An exclamation mark shows an NPC with an active or new goal. Approach a nearby NPC to talk.`} />
    {!ready || error ? <div className="station-loading absolute [top:40%] [left:50%] [transform:translateX(-50%)] bg-dialogue p-5 rounded-[16px] max-w-[calc(100%_-_24px)]">{error ? <><p role="alert">{error}</p><GameButton label="Retry map" onClick={() => setAttempt((value) => value + 1)} /></> : <p role="status">Loading map… {Math.round(progress * 100)}%</p>}</div> : null}
    {ready && !error && npc && !paused ? <div className="talk-control absolute [bottom:max(24px,_env(safe-area-inset-bottom))] right-3"><GameButton label={width < 700 ? 'Talk' : `Talk to ${npc.name} · E`} ariaLabel={`Talk to ${npc.name}`} onClick={() => game.current?.talk()} /></div> : null}
  </div>;
}
