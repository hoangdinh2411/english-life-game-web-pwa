import { useEffect, useId, useRef, useState } from "react";
import { canSleep } from "@life-abroad/shared";

export interface EnergyDisplayProps {
  energy?: number;
  onSleep?: () => void;
  sleepDisabled?: boolean;
}

export function EnergyDisplay({
  energy,
  onSleep,
  sleepDisabled = false,
}: EnergyDisplayProps) {
  const [shown, setShown] = useState(energy);
  const valueRef = useRef(energy);
  const [tip, setTip] = useState(false);
  const previewTap = useRef(false);
  const tipId = useId();

  useEffect(() => {
    const start = valueRef.current;
    const update = (value: number | undefined) => {
      valueRef.current = value;
      setShown(value);
    };

    if (
      energy === undefined ||
      start === undefined ||
      energy <= start ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      update(energy);
      return;
    }

    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / 1200);
      update(Math.round(start + (energy - start) * progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [energy]);

  useEffect(() => {
    if (!tip) return;
    const timer = window.setTimeout(() => setTip(false), 4000);
    return () => window.clearTimeout(timer);
  }, [tip]);

  if (energy === undefined)
    return (
      <div className="energy-display [flex-basis:100%] w-full mt-1 pt-1.5 [border-top:1px_solid_var(--color-energy-divider)] text-ink [font-family:inherit]">
        <span role="status">Loading energy…</span>
      </div>
    );

  const value = shown ?? energy;
  const disabled = sleepDisabled || !canSleep(energy);
  const explanation = !canSleep(energy)
    ? "Quick rest · Available below 30% energy"
    : sleepDisabled
      ? "Quick rest · Reconnect or finish the current action"
      : "Quick rest · Restores 50 energy · Tap again to rest";

  return (
    <div className={`energy-display [flex-basis:100%] w-full mt-1 pt-1.5 [border-top:1px_solid_var(--color-energy-divider)] text-ink [font-family:inherit] ${energy <= 20 ? "energy-low [&_.energy-fill]:bg-[linear-gradient(90deg,_var(--color-energy-low-start),_var(--color-energy-low-end))]" : ""}`}>
      <div
        className="energy-top-row mb-[3px] flex justify-between text-[11px] font-bold"
      >
        <span className="energy-label text-[12px] font-bold min-w-[55px]">AP: {value}%</span>
      </div>

      <div className="energy-row flex items-center gap-2 min-w-0">
        <div
          className="energy-battery relative grow h-3.5 bg-[var(--color-energy-track)] [border:1.5px_solid_var(--color-energy-border)] rounded-[7px] overflow-hidden flex items-center p-px [&_strong]:hidden"
          role="progressbar"
          aria-label="Energy"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={value}
        >
          <div
            className="energy-fill h-full bg-[linear-gradient(90deg,_var(--color-energy-fill-start),_var(--color-energy-fill-end))] rounded-[5px] [transition:width_0.3s_ease]"
            style={{ width: `${value}%` }}
          />
        </div>

        {onSleep ? (
          <div className="sleep-control [@media(hover:hover)]:[&:hover_.sleep-tooltip]:block relative [margin-left:auto] [&:focus-within_.sleep-tooltip]:block">
            <button type="button"
              className="sleep-button flex cursor-pointer justify-center items-center w-11 h-11 p-0! [border:1px_solid_var(--color-hint)] rounded-[10px] bg-card text-ink [&[aria-disabled=true]]:text-muted [&[aria-disabled=true]]:[border-style:dashed] [&[aria-disabled=true]]:cursor-default"
              aria-label="Quick rest to restore energy"
              aria-disabled={disabled}
              aria-describedby={tipId}
              onPointerDown={(event) => {
                previewTap.current = event.pointerType === "touch" && !tip;
              }}
              onClick={() => {
                if (previewTap.current) {
                  previewTap.current = false;
                  setTip(true);
                  return;
                }
                if (!disabled) {
                  setTip(false);
                  onSleep();
                } else {
                  setTip(true);
                }
              }}
              onBlur={() => setTip(false)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setTip(false);
              }}
            >
              <svg
                aria-hidden="true"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            </button>

            <span
              id={tipId}
              role="tooltip"
              className={`sleep-tooltip hidden absolute right-0 [top:calc(100%_+_6px)] p-2 rounded-[8px] text-card bg-ink text-[12px] leading-[1.4] z-[10] [&.is-visible]:block ${tip ? " is-visible" : ""}`}
            >
              {explanation}
            </span>
          </div>
        ) : null}
      </div>

      {energy <= 20 ? (
        <span className="energy-warning block mt-0.5 text-[11px] font-bold text-[var(--color-warning)]">
          {energy === 0
            ? "No energy · Rest or eat to chat"
            : "Low energy · Eat or rest"}
        </span>
      ) : null}
    </div>
  );
}


