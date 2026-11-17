import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";

export interface VirtualJoystickProps {
  userMode?: "kid" | "adult";
  visible?: boolean;
}

export function VirtualJoystick({ userMode = "adult", visible = true }: VirtualJoystickProps) {
  const isKid = userMode === "kid";
  const [active, setActive] = useState(false);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const activeKeyRef = useRef<string | null>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const pointerIdRef = useRef<number | null>(null);

  const dispatchKey = useCallback((key: string | null) => {
    if (activeKeyRef.current === key) return;
    if (activeKeyRef.current) {
      window.dispatchEvent(new KeyboardEvent("keyup", { key: activeKeyRef.current, bubbles: true }));
    }
    activeKeyRef.current = key;
    if (key) {
      window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    }
  }, []);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== null) return;
    pointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    setActive(true);
    handlePointerMove(event);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId || !baseRef.current) return;
    const rect = baseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = event.clientX - centerX;
    const dy = event.clientY - centerY;
    const distance = Math.hypot(dx, dy);
    const maxRadius = rect.width / 2 - 12;

    const clampedDist = Math.min(distance, maxRadius);
    const angle = Math.atan2(dy, dx);
    const x = Math.cos(angle) * clampedDist;
    const y = Math.sin(angle) * clampedDist;

    setKnobPos({ x, y });

    // Threshold for directional trigger
    if (clampedDist > 14) {
      const deg = (angle * 180) / Math.PI;
      if (deg >= -45 && deg <= 45) {
        dispatchKey("ArrowRight");
      } else if (deg > 45 && deg < 135) {
        dispatchKey("ArrowDown");
      } else if (deg >= 135 || deg <= -135) {
        dispatchKey("ArrowLeft");
      } else {
        dispatchKey("ArrowUp");
      }
    } else {
      dispatchKey(null);
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current === event.pointerId) {
      pointerIdRef.current = null;
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
      setActive(false);
      setKnobPos({ x: 0, y: 0 });
      dispatchKey(null);
    }
  };

  useEffect(() => {
    return () => {
      if (activeKeyRef.current) {
        window.dispatchEvent(new KeyboardEvent("keyup", { key: activeKeyRef.current, bubbles: true }));
      }
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      ref={baseRef}
      role="region"
      aria-label="Virtual directional joystick"
      className={`virtual-joystick pointer-events-auto absolute bottom-4 left-4 z-[15] select-none touch-none grid place-items-center rounded-full border-2 transition-all md:hidden ${
        isKid
          ? "size-28 border-[var(--color-gold-border)] bg-[rgba(255,248,233,0.7)] shadow-md"
          : "size-24 border-[var(--color-border)] bg-[rgba(36,31,25,0.45)] shadow-sm"
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div
        className={`size-12 rounded-full border shadow-inner transition-transform ${
          isKid
            ? "border-[var(--color-gold-border)] bg-[var(--color-gold)]"
            : "border-[var(--color-gold-border)] bg-[var(--color-card)]"
        }`}
        style={{
          transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
        }}
        aria-hidden="true"
      >
        <span className="grid size-full place-items-center text-xs text-ink opacity-70">
          {active ? (isKid ? "⭐" : "●") : isKid ? "🎮" : "✦"}
        </span>
      </div>
    </div>
  );
}
