import { useCallback, useEffect, useRef, useState } from "react";
import { Minimap, type MinimapBounds } from "../features/minimap/Minimap";
import { GameButton } from "./GameButton";
import type {
  GameCanvasProps,
  NpcTalkPrompt,
  StationGame,
} from "../types/gameplay/world";
import { syncNpcPresence } from "../features/npcs/npc-presence";

const DEFAULT_INITIAL_LOCATION = {
  mapId: "loc_station",
  placeId: "loc_station",
  x: 768,
  y: 370,
} as const;

export default function GameCanvas({
  gender,
  countryName,
  paused,
  worldPaused = paused,
  conversationNpcId = null,
  minimapVisible = true,
  exitUnlocked,
  onExitBlocked,
  onTalk,
  onReadyChange,
  onLocationChange,
  onMapChange,
  onPlaceChange,
  initialLocation = DEFAULT_INITIAL_LOCATION,
  onEnterStreet,
  appearance,
  getGameTime,
  getTimeZone,
  onStoreClosed,
  presentNpcIds,
}: GameCanvasProps) {
  const initialMapId = initialLocation.mapId;
  const initialPlaceId = initialLocation.placeId;
  const initialX = initialLocation.x;
  const initialY = initialLocation.y;
  const parent = useRef<HTMLDivElement>(null);
  const game = useRef<StationGame | null>(null);
  const readMinimap = useCallback(
    () => game.current?.readMinimap() ?? null,
    [],
  );
  const callbacks = useRef({
    onTalk,
    onLocationChange,
    onMapChange,
    onPlaceChange,
    onExitBlocked,
    onReadyChange,
    onEnterStreet,
    getGameTime,
    getTimeZone,
    onStoreClosed,
  });
  callbacks.current = {
    onTalk,
    onLocationChange,
    onMapChange,
    onPlaceChange,
    onExitBlocked,
    onReadyChange,
    onEnterStreet,
    getGameTime,
    getTimeZone,
    onStoreClosed,
  };
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const worldPausedRef = useRef(worldPaused);
  worldPausedRef.current = worldPaused;
  const conversationRef = useRef(conversationNpcId);
  conversationRef.current = conversationNpcId;
  const exitRef = useRef(exitUnlocked);
  exitRef.current = exitUnlocked;
  const appearanceRef = useRef(appearance);
  appearanceRef.current = appearance;
  const presentNpcIdsRef = useRef(presentNpcIds);
  presentNpcIdsRef.current = presentNpcIds;
  useEffect(() => {
    game.current?.setAppearance(appearance);
  }, [appearance]);
  const [talkPrompt, setTalkPrompt] = useState<NpcTalkPrompt | null>(null);
  const [minimapBounds, setMinimapBounds] = useState<MinimapBounds | null>(
    null,
  );
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [locationLabel, setLocationLabel] = useState(
    initialPlaceId === "loc_town_street"
      ? "Town Street"
      : "Train Station",
  );
  const [attempt, setAttempt] = useState(0);
  const [progress, setProgress] = useState(0);
  const serverExit = Boolean(onEnterStreet);
  const talkCovered =
    talkPrompt &&
    minimapBounds &&
    talkPrompt.x + 30 >= minimapBounds.left &&
    talkPrompt.x - 30 <= minimapBounds.right &&
    talkPrompt.y - 44 <= minimapBounds.bottom;
  const talkPosition = talkCovered
    ? { x: minimapBounds.right - 30, y: minimapBounds.bottom + 50 }
    : talkPrompt;
  useEffect(() => {
    let cancelled = false;
    let instance: StationGame | null = null;
    const host = document.createElement("div");
    host.className =
      "phaser-host w-full h-full overflow-hidden bg-[var(--color-dark-surface)] touch-none";
    parent.current?.append(host);
    setReady(false);
    setError("");
    setTalkPrompt(null);
    callbacks.current.onReadyChange(false);
    const start = async () => {
      const { createStationGame } = await import("./create-station-game");
      if (cancelled) return;
      const stableInitialLocation = {
        mapId: initialMapId,
        placeId: initialPlaceId,
        x: initialX,
        y: initialY,
      };
      instance = createStationGame(host, {
        gender,
        countryName,
        initialLocation: stableInitialLocation,
        appearance: appearanceRef.current,
        practice: !serverExit,
        onProgress: (value) => {
          if (!cancelled) setProgress(value);
        },
        ...(serverExit
          ? {
              onEnterStreet: () =>
                callbacks.current.onEnterStreet?.() ?? Promise.resolve(false),
            }
          : {}),
        ...(serverExit
          ? {
              getGameTime: () => callbacks.current.getGameTime?.() ?? null,
              getTimeZone: () => callbacks.current.getTimeZone?.() ?? null,
              onStoreClosed: (location) =>
                callbacks.current.onStoreClosed?.(location),
            }
          : {}),
        onNearby: () => {},
        onTalkPrompt: (prompt) => {
          if (!cancelled)
            setTalkPrompt((previous) =>
              previous?.npcId === prompt?.npcId &&
              previous?.x === prompt?.x &&
              previous?.y === prompt?.y
                ? previous
                : prompt,
            );
        },
        onTalk: (id) => {
          if (!cancelled) callbacks.current.onTalk(id);
        },
        onReady: () => {
          if (!cancelled) {
            setReady(true);
            callbacks.current.onReadyChange(true);
          }
        },
        onLocationChange: (location) => {
          if (!cancelled) {
            setLocationLabel(location);
            setTalkPrompt(null);
            setReady(false);
            callbacks.current.onReadyChange(false);
            callbacks.current.onLocationChange(location);
          }
        },
        onMapChange: (mapId) => {
          if (!cancelled) callbacks.current.onMapChange?.(mapId);
        },
        onPlaceChange: (savedLocation) => {
          if (!cancelled) callbacks.current.onPlaceChange?.(savedLocation);
        },
        onError: (message) => {
          if (!cancelled) {
            setError(message);
            callbacks.current.onReadyChange(false);
          }
        },
        onExitBlocked: () => {
          if (!cancelled) callbacks.current.onExitBlocked();
        },
      });
      game.current = instance;
      syncNpcPresence(instance, presentNpcIdsRef.current);
      instance.pause(
        pausedRef.current || document.hidden,
        worldPausedRef.current || document.hidden,
        conversationRef.current,
      );
      instance.unlockExit(exitRef.current);
    };
    const visibility = () =>
      instance?.pause(
        pausedRef.current || document.hidden,
        worldPausedRef.current || document.hidden,
        conversationRef.current,
      );
    document.addEventListener("visibilitychange", visibility);
    void start().catch((failure: unknown) => {
      if (!cancelled) {
        setError(
          `The station could not start. ${failure instanceof Error ? failure.message : "Please retry."}`,
        );
        callbacks.current.onReadyChange(false);
      }
    });
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", visibility);
      instance?.destroy();
      if (game.current === instance) game.current = null;
      host.remove();
    };
  }, [attempt, initialMapId, initialPlaceId, initialX, initialY, serverExit]);
  useEffect(() => {
    game.current?.pause(
      paused || document.hidden,
      worldPaused || document.hidden,
      conversationNpcId,
    );
  }, [paused, worldPaused, conversationNpcId]);
  useEffect(() => {
    game.current?.unlockExit(exitUnlocked);
  }, [exitUnlocked]);
  useEffect(() => {
    syncNpcPresence(game.current, presentNpcIds);
  }, [presentNpcIds]);
  return (
    <div className="game-canvas absolute inset-0">
      <Minimap
        visible={minimapVisible && ready && !error}
        read={readMinimap}
        onBounds={setMinimapBounds}
      />
      <div
        ref={parent}
        className="canvas-parent absolute inset-0 w-full h-full overflow-hidden bg-[var(--color-dark-surface)] touch-none"
        role="img"
        aria-label={`${locationLabel}. Tap the path to walk, or use arrow keys or WASD. An exclamation mark shows an NPC with an active or new goal. Approach a nearby NPC to talk.`}
      />
      {!ready || error ? (
        <div className="station-loading absolute [top:50%] [left:50%] [transform:translateX(-50%)] bg-dialogue p-5 rounded-[16px] max-w-[calc(100%_-_24px)]">
          {error ? (
            <>
              <p role="alert">{error}</p>
              <GameButton
                label="Retry map"
                onClick={() => setAttempt((value) => value + 1)}
              />
            </>
          ) : (
            <p role="status">Loading map… {Math.round(progress * 100)}%</p>
          )}
        </div>
      ) : null}
      {ready && !error && talkPrompt && !paused ? (
        <button
          type="button"
          className="talk-control absolute z-10 cursor-pointer rounded-sm border-0 bg-[var(--color-green-strong)] p-0 text-[12px] font-bold leading-tight text-[var(--color-cream-text)] lg:bg-transparent hover:bg-[var(--color-green-deep)] lg:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gold)]"
          style={{
            left: talkPosition?.x,
            top: talkPosition?.y,
            transform: "translate(-50%, -100%)",
          }}
          aria-label={`Talk to ${talkPrompt.name}`}
          aria-keyshortcuts="E"
          onClick={() => game.current?.talk()}
        >
          <span className="inline-flex p-1.5  rounded lg:items-center lg:bg-[var(--color-green-strong)]">
            Talk
          </span>
        </button>
      ) : null}
    </div>
  );
}
