import { useCallback, useEffect, useRef, useState } from "react";
import {
  MINIMAP_STORAGE_KEY,
  nextMode,
  readMode,
  type MinimapMode,
  type MinimapSnapshot,
} from "./model";
import { observeMinimap } from "./polling";
import { drawMinimap } from "./draw";
import { GameIcon } from "../../shared/GameIcon";

interface Props {
  visible: boolean;
  read: () => MinimapSnapshot | null;
}
const buttonStyle =
  "grid size-8 cursor-pointer place-items-center rounded-lg border border-[var(--color-overlay-border)] bg-[var(--color-cream-text)] text-[var(--color-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-map-player)] sm:size-9";

function initialMode(): MinimapMode {
  try {
    return readMode(window.localStorage, window.innerWidth);
  } catch {
    return readMode(
      undefined,
      typeof window === "undefined" ? 1024 : window.innerWidth,
    );
  }
}

export function Minimap({ visible, read }: Props) {
  const [mode, setMode] = useState(initialMode);
  const [snapshot, setSnapshot] = useState<MinimapSnapshot | null>(null);
  const root = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [width, setWidth] = useState(300);
  const open = mode === "visible";
  const choose = useCallback((value: MinimapMode) => {
    setMode(value);
    try {
      localStorage.setItem(MINIMAP_STORAGE_KEY, value);
    } catch {
      /* Keep an in-memory choice. */
    }
  }, []);
  useEffect(() => {
    const element = root.current;
    if (!visible || !element) return;
    const parent = element.parentElement;
    const measure = () => {
      if (parent) {
        const desktop = window.innerWidth >= 1024;
        const ratio = (snapshot?.width ?? 3) / (snapshot?.height ?? 2);
        const availableHeight = Math.max(100, parent.clientHeight - 210);
        setWidth(
          Math.floor(
            Math.min(
              parent.clientWidth * (desktop ? 0.46 : 0.9),
              desktop ? 640 : 420,
              availableHeight * ratio,
            ),
          ),
        );
      }
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (parent) observer.observe(parent);
    window.addEventListener("resize", measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [visible, mode, snapshot?.width, snapshot?.height]);
  useEffect(() => {
    if (!visible || !open) {
      setSnapshot(null);
      return;
    }
    return observeMinimap(read, setSnapshot, document, window);
  }, [visible, open, read]);
  useEffect(() => {
    if (visible && snapshot && canvas.current)
      drawMinimap(canvas.current, snapshot);
  }, [visible, snapshot, width]);
  useEffect(() => {
    if (!visible) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        choose("hidden");
    };
    const keyboard = (event: KeyboardEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest('input,textarea,select,[contenteditable="true"]')
      )
        return;
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat)
        return;
      if (event.key.toLowerCase() === "m") {
        event.preventDefault();
        choose(nextMode(mode));
      }
      if (event.key === "Escape" && open) {
        choose("hidden");
        button.current?.focus();
      }
    };
    document.addEventListener("keydown", keyboard);
    if (open) document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", keyboard);
      document.removeEventListener("pointerdown", outside);
    };
  }, [visible, open, mode, choose]);
  if (!visible) return null;
  return (
    <section
      ref={root}
      aria-label="Minimap"
      style={open ? { width } : undefined}
      className="absolute right-[max(8px,env(safe-area-inset-right))] top-[calc(max(8px,env(safe-area-inset-top))+52px)] z-20 flex max-h-[calc(100%_-_132px)] flex-col"
    >
      <div className="flex shrink-0 justify-end">
        <button
          ref={button}
          type="button"
          className={buttonStyle}
          aria-label={open ? "Hide minimap" : "Show minimap"}
          aria-expanded={open}
          aria-controls="minimap-content"
          aria-keyshortcuts="M"
          onClick={() => choose(nextMode(mode))}
        >
          <GameIcon name="map" className="size-4 sm:size-5" />
        </button>
      </div>
      {open ? (
        <div
          id="minimap-content"
          className="mt-1 min-h-0 overflow-y-auto rounded-lg bg-[var(--color-gold)] text-[12px] leading-normal text-[var(--color-ink)]"
        >
          {snapshot ? (
            <>
              <h2 className="p-2 text-right text-[12px] font-bold leading-snug [text-shadow:0_1px_2px_var(--color-cream-text),0_-1px_2px_var(--color-cream-text),1px_0_2px_var(--color-cream-text),-1px_0_2px_var(--color-cream-text)] lg:text-[14px]">
                {snapshot.name}
              </h2>
              <canvas
                ref={canvas}
                data-map-id={snapshot.mapId}
                style={{
                  aspectRatio: `${snapshot.width} / ${snapshot.height}`,
                }}
                className="block h-auto w-full"
                role="img"
                aria-label={`Current map: ${snapshot.npcs.length} people. ${snapshot.name}. Player: blue circle. People: ${snapshot.npcs.map((npc) => `${npc.objective ? "! " : ""}${npc.name}`).join(", ")}. Exits: ${snapshot.portals.map((portal) => portal.label).join(", ")}.`}
              />
            </>
          ) : (
            <p
              role="status"
              className="p-2"
            >
              Loading map…
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
