import { useEffect, useRef, useState } from "react";
import type { FlightCutsceneProps } from "../../types/ui/gameplay";

export interface FlightCutsceneTimerOptions {
  durationMs?: number | undefined;
  reducedMotion?: boolean | undefined;
  onComplete: () => void;
  setTimeoutFn?: typeof setTimeout | undefined;
  clearTimeoutFn?: typeof clearTimeout | undefined;
}

export function getFlightCutsceneDuration(
  durationMs = 3500,
  reducedMotion = false,
): number {
  return reducedMotion ? Math.min(durationMs, 500) : durationMs;
}

export function startFlightCutsceneTimer({
  durationMs = 3500,
  reducedMotion = false,
  onComplete,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
}: FlightCutsceneTimerOptions): () => void {
  const effectiveDuration = getFlightCutsceneDuration(durationMs, reducedMotion);
  const timer = setTimeoutFn(() => {
    onComplete();
  }, effectiveDuration);
  return () => clearTimeoutFn(timer);
}

export function FlightCutscene({
  destinationCountryName,
  durationMs = 3500,
  onComplete,
}: FlightCutsceneProps) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener?.("change", handler);
    return () => mediaQuery.removeEventListener?.("change", handler);
  }, []);

  useEffect(() => {
    return startFlightCutsceneTimer({
      durationMs,
      reducedMotion,
      onComplete: () => onCompleteRef.current(),
    });
  }, [durationMs, reducedMotion]);

  // Keyboard shortcut to skip
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        onCompleteRef.current();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const countryLabel =
    destinationCountryName && destinationCountryName !== "Not selected"
      ? destinationCountryName
      : "Arrival Terminal";

  const effectiveDuration = getFlightCutsceneDuration(durationMs, reducedMotion);

  return (
    <div
      className="flight-cutscene fixed inset-0 z-[1000] flex flex-col justify-between bg-[var(--color-dark-surface)] text-[var(--color-cream-text-pure)] overflow-hidden select-none p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Flight cutscene"
    >
      <style>{`
        @keyframes flight-bob {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-8px) rotate(1.5deg);
          }
        }
        @keyframes cloud-drift-slow {
          0% {
            transform: translateX(110%);
          }
          100% {
            transform: translateX(-110%);
          }
        }
        @keyframes cloud-drift-fast {
          0% {
            transform: translateX(125%);
          }
          100% {
            transform: translateX(-125%);
          }
        }
        @keyframes flight-progress-fill {
          0% {
            width: 0%;
          }
          100% {
            width: 100%;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .flight-anim-bob,
          .flight-cloud-drift-1,
          .flight-cloud-drift-2,
          .flight-cloud-drift-3 {
            animation: none !important;
          }
          .flight-progress-fill {
            animation: none !important;
            width: 100% !important;
          }
        }
      `}</style>

      {/* Top Bar */}
      <header className="flex items-center justify-between z-10 w-full max-w-3xl mx-auto">
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-[var(--color-green-deep)]/80 border border-[var(--color-gold)]/40">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full bg-[var(--color-gold)] animate-pulse [@media(prefers-reduced-motion:reduce)]:animate-none"
            aria-hidden="true"
          />
          <span className="text-xs uppercase tracking-widest font-semibold text-[var(--color-gold)]">
            Flight in Progress
          </span>
        </div>
        <button
          type="button"
          onClick={onComplete}
          aria-label="Skip flight cutscene"
          className="px-4 py-1.5 rounded-lg border border-[var(--color-gold)] bg-[var(--color-green-deep)] hover:bg-[var(--color-green-strong)] active:scale-95 text-xs font-semibold tracking-wide text-[var(--color-cream-text-pure)] cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]"
        >
          Skip
        </button>
      </header>

      {/* Center Sky Scene with Airplane and Cloud Parallax */}
      <div className="relative flex-1 w-full max-w-4xl mx-auto flex items-center justify-center overflow-hidden my-4">
        {/* Parallax Clouds - Layer 1 (Far, Slower, Higher) */}
        <div
          className="flight-cloud-drift-1 absolute top-[15%] left-0 w-36 sm:w-48 text-[var(--color-energy-track)]/20 pointer-events-none"
          style={{
            animation: reducedMotion
              ? "none"
              : "cloud-drift-slow 7s linear infinite",
            animationDelay: "0s",
          }}
          aria-hidden="true"
        >
          <svg viewBox="0 0 100 40" fill="currentColor" className="w-full h-auto">
            <path d="M 15 35 A 15 15 0 0 1 35 20 A 20 20 0 0 1 70 20 A 15 15 0 0 1 85 35 Z" />
          </svg>
        </div>

        {/* Parallax Clouds - Layer 2 (Mid, Lower) */}
        <div
          className="flight-cloud-drift-2 absolute bottom-[25%] left-0 w-44 sm:w-60 text-[var(--color-energy-track)]/25 pointer-events-none"
          style={{
            animation: reducedMotion
              ? "none"
              : "cloud-drift-fast 5s linear infinite",
            animationDelay: "-2.5s",
          }}
          aria-hidden="true"
        >
          <svg viewBox="0 0 100 40" fill="currentColor" className="w-full h-auto">
            <path d="M 20 35 A 18 18 0 0 1 45 15 A 25 25 0 0 1 80 18 A 15 15 0 0 1 95 35 Z" />
          </svg>
        </div>

        {/* Parallax Clouds - Layer 3 (Foreground, Faster, Low) */}
        <div
          className="flight-cloud-drift-3 absolute top-[60%] left-0 w-28 sm:w-40 text-[var(--color-energy-track)]/15 pointer-events-none"
          style={{
            animation: reducedMotion
              ? "none"
              : "cloud-drift-slow 6s linear infinite",
            animationDelay: "-3.5s",
          }}
          aria-hidden="true"
        >
          <svg viewBox="0 0 100 40" fill="currentColor" className="w-full h-auto">
            <path d="M 10 35 A 12 12 0 0 1 30 22 A 18 18 0 0 1 65 24 A 12 12 0 0 1 80 35 Z" />
          </svg>
        </div>

        {/* Airplane Center Visual */}
        <div
          className="flight-anim-bob relative z-20 flex flex-col items-center pointer-events-none"
          style={{
            animation: reducedMotion
              ? "none"
              : "flight-bob 2.2s ease-in-out infinite",
          }}
        >
          {/* Airplane SVG */}
          <svg
            className="w-32 h-32 sm:w-44 sm:h-44 drop-shadow-[0_12px_24px_rgba(0,0,0,0.5)]"
            viewBox="0 0 120 120"
            fill="none"
            aria-hidden="true"
          >
            {/* Plane Body / Fuselage */}
            <path
              d="M 20 60 L 60 52 L 105 57 C 112 58 116 62 105 65 L 60 70 L 20 62 Z"
              fill="var(--color-cream-text-pure)"
            />
            {/* Cockpit Window */}
            <path
              d="M 95 58 Q 102 59 104 61 Q 98 62 93 61 Z"
              fill="var(--color-dark-surface)"
            />
            {/* Main Wings */}
            <polygon
              points="55,54 38,20 50,20 74,54"
              fill="var(--color-green-strong)"
            />
            <polygon
              points="55,67 38,102 50,102 74,67"
              fill="var(--color-green-deep)"
            />
            {/* Tail Fin */}
            <polygon
              points="22,60 12,38 22,38 32,60"
              fill="var(--color-gold)"
            />
            {/* Accent Stripe along Fuselage */}
            <path
              d="M 32 61 L 98 61"
              stroke="var(--color-gold)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>

          {/* Jet trail / contrail */}
          <div
            className="w-24 sm:w-36 h-1 rounded-full bg-gradient-to-r from-transparent to-[var(--color-cream-text-pure)]/30 mt-[-10px] mr-24 pointer-events-none"
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Bottom Route Status & Progress */}
      <footer className="z-10 w-full max-w-xl mx-auto flex flex-col items-center gap-3">
        <h2 className="text-lg sm:text-2xl font-bold tracking-wide text-center text-[var(--color-cream-text-pure)]">
          Flying to {countryLabel}
        </h2>

        {/* Route Progress Track */}
        <div className="w-full px-2">
          <div className="relative h-2.5 w-full rounded-full bg-[var(--color-energy-track)]/20 overflow-hidden border border-[var(--color-energy-track)]/30">
            <div
              className="flight-progress-fill h-full rounded-full bg-[var(--color-gold)]"
              style={{
                animation: reducedMotion
                  ? "none"
                  : `flight-progress-fill ${effectiveDuration}ms linear forwards`,
                width: reducedMotion ? "100%" : undefined,
              }}
            />
          </div>

          {/* Route Terminals */}
          <div className="flex justify-between items-center text-xs font-medium text-[var(--color-cream-text-pure)]/80 mt-2">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--color-energy-track)]/60" />
              Departure Gate
            </span>
            <span className="flex items-center gap-1.5 text-[var(--color-gold)] font-semibold">
              {countryLabel}
              <span className="w-2 h-2 rounded-full bg-[var(--color-gold)]" />
            </span>
          </div>
        </div>

        <p className="text-xs text-[var(--color-cream-text-pure)]/60 tracking-wider">
          Fasten your seatbelt • In-flight transition
        </p>
      </footer>
    </div>
  );
}
