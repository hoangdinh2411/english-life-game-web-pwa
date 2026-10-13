import type { PlayerInfoCardProps } from "../types/ui/gameplay";
import { useEffect, useState } from "react";
import { playerPortrait } from "./portraits";
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
  coins,
  visible = true,
  timeZone,
  savedTime,
  clockRate,
  onOpenProfile,
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
  return <aside hidden={!visible} className="player-card w-[min(260px,_100%)] min-w-0 [&[hidden]]:hidden">
    <button type="button" className="pointer-events-auto flex min-h-14 w-full min-w-0 items-center gap-2 rounded-[14px] bg-[rgba(255,_248,_233,_0.97)] [border:2px_solid_#8b806c] p-2 text-left text-ink shadow-[0_2px_6px_#0004] hover:bg-[#fffaf0]" aria-label={`Open ${playerName}'s profile`} onClick={() => onOpenProfile()}>
      <img alt="" aria-hidden="true" src={playerPortrait} width="40" height="40" className="shrink-0 rounded-full [border:1px_solid_#8b806c] bg-[#f3e4c2]" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <strong className="truncate text-[14px] leading-tight">{playerName}</strong>
        <span className="truncate text-[12px] leading-tight text-[#52644f]">{cityName} · ${coins}</span>
      </span>
      <span className="shrink-0 text-[12px] tabular-nums text-[#263630]" aria-label={`Game time ${timeLabel}`}>◷ {timeLabel}</span>
    </button>
  </aside>;
}
