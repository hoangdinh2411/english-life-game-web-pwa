import type { PlayerInfoCardProps } from "../types/ui/gameplay";
import { useEffect, useState } from "react";
import { playerPortrait } from "./portraits";
import { EnergyDisplay } from "../features/life/EnergyDisplay";
import { GAME_TIME_RATE } from "@life-abroad/shared";
function useGameClock(rate: number) {
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  return new Date(startedAt + (now - startedAt) * rate);
}
export function PlayerInfoCard({
  playerName,
  cityName,
  xp,
  coins,
  visible = true,
  timeZone,
  savedTime,
  clockRate,
  energy,
  onSleep,
  sleepDisabled,
}: PlayerInfoCardProps) {
  const rate = clockRate ?? GAME_TIME_RATE;
  const practiceTime = useGameClock(rate);
  const gameTime = savedTime ?? practiceTime;
  const resolvedTimeZone =
    savedTime !== undefined
      ? "UTC"
      : (timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  const timeLabel = new Intl.DateTimeFormat(undefined, {
    timeZone: resolvedTimeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(gameTime);
  const zoneLabel =
    new Intl.DateTimeFormat(undefined, {
      timeZone: resolvedTimeZone,
      timeZoneName: "short",
    })
      .formatToParts(gameTime)
      .find((part) => part.type === "timeZoneName")?.value ?? "";
  return (
    <aside
      hidden={!visible}
      className="player-card w-[min(320px,_100%)] min-w-0 flex flex-col items-start gap-1 [padding:8px_10px] bg-[rgba(255,_248,_233,_0.97)] [border:1px_solid_#aa8b57] rounded-[14px] [&[hidden]]:hidden [&_img]:shrink-0 [&_img]:[border:1px_solid_#d7c49b] [&_img]:rounded-[50%] [&_img]:bg-[#f3e4c2] [@media(max-width:479px)]:gap-2 [@media(max-width:479px)]:p-2"
      aria-label={`Player ${playerName}, ${cityName}, ${coins} dollars, ${xp} XP. Game time ${timeLabel} ${zoneLabel}, running at ${rate} times real time.`}
    >
      <div className="player-details flex-1 min-w-0 flex [gap:4px_8px] text-[12px] text-[#52644f] tabular-nums [@media(max-width:479px)]:flex [@media(max-width:479px)]:flex-wrap [@media(max-width:479px)]:[gap:2px_8px] [@media(max-width:479px)]:[&_>_strong]:[flex-basis:100%] [@media(max-width:479px)]:[&_>_span:nth-child(2)]:[flex-basis:100%] [@media(max-width:479px)]:[&_>_strong]:text-[14px]">
        <img
          alt={`${playerName}'s avatar`}
          src={playerPortrait}
          width="44"
          height="44"
        />
        <div className="player-info flex flex-col gap-1 [&_>_strong]:text-[15px] [&_>_strong]:text-ink [&_.coins]:text-[#8b5b17] [&_.coins]:font-extrabold [&_b]:text-[#8b5b17]">
          <strong className="truncate">{playerName}</strong>
          <span className="truncate">{cityName}</span>
          <span
            aria-label={`${coins} dollars`}
            className="coins [@media(max-width:479px)]:[&_img]:w-9 [@media(max-width:479px)]:[&_img]:h-9"
          >
            $ {coins}
          </span>
        </div>
        <span className="min-w-0 [@media(max-width:479px)]:[flex-basis:100%]" aria-label={`Game time ${timeLabel} ${zoneLabel} at ${rate} times real time`}>
          ◷ {timeLabel} {zoneLabel} · {rate}×
        </span>
      </div>
      {energy !== undefined || savedTime !== undefined ? (
        <EnergyDisplay
          {...(energy !== undefined ? { energy } : {})}
          {...(onSleep ? { onSleep } : {})}
          {...(sleepDisabled !== undefined ? { sleepDisabled } : {})}
        />
      ) : (
        <span className="energy-display [flex-basis:100%] w-full mt-1 pt-1.5 [border-top:1px_solid_#d7c49b] text-ink [font-family:inherit]">Local practice · No energy cost</span>
      )}
    </aside>
  );
}
