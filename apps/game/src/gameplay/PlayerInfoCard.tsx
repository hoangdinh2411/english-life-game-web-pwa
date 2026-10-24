import type { PlayerInfoCardProps } from "../types/ui/gameplay";
import { useEffect, useState } from "react";
import { PlayerPortrait } from "../features/appearance/PlayerPortrait";
import { GAME_TIME_RATE } from "@life-abroad/shared";
import { formatWorldTime } from "../features/world-clock/world-clock";
function useGameClock(rate: number) {
  const [startedAt] = useState(() => performance.now());
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(performance.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  return new Date(Date.parse('2000-01-01T08:00:00.000Z') + (now - startedAt) * rate);
}
export function PlayerInfoCard({
  gender,
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
  const resolvedTimeZone = timeZone ?? (savedTime !== undefined ? 'UTC' : Intl.DateTimeFormat().resolvedOptions().timeZone);
  const timeLabel = savedTime === null ? 'Syncing…' : formatWorldTime(gameTime, resolvedTimeZone);
  return <aside hidden={!visible} className="player-card w-[min(260px,_100%)] max-lg:w-[min(260px,_calc(50vw_-_8px),_100%)] min-w-0 [&[hidden]]:hidden">
    <button type="button" className="pointer-events-auto flex min-h-11 w-full min-w-0 items-center gap-1.5 rounded-[12px] bg-dialogue border-2 border-border p-1 text-left text-ink shadow-[0_2px_6px_#0004] lg:hidden" aria-label={`Open ${playerName}'s profile`} onClick={onOpenProfile}>
      <PlayerPortrait gender={gender} className="size-6 rounded-full" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-baseline gap-1 text-[11px] leading-tight"><strong title={playerName} className="min-w-0 truncate">{playerName}</strong><span className="shrink-0 tabular-nums">${coins.toLocaleString('en-US')}</span></span>
        <span className="text-[10px] leading-tight tabular-nums" aria-label={`Game time ${timeLabel}`}>{timeLabel}</span>
      </span>
    </button>
    <button type="button" className="pointer-events-auto hidden lg:flex flex-wrap min-h-14 w-full min-w-0 items-center gap-2 rounded-[14px] bg-[rgba(255,_248,_233,_0.97)] [border:2px_solid_#8b806c] p-2 text-left text-ink shadow-[0_2px_6px_#0004] hover:bg-[#fffaf0]" aria-label={`Open ${playerName}'s profile`} onClick={() => onOpenProfile()}>
      <PlayerPortrait gender={gender} className="size-10 rounded-full [border:1px_solid_#8b806c]" />
      <span className="flex min-w-[6em] flex-1 flex-col gap-0.5">
        <strong className="truncate text-[14px] leading-tight">{playerName}</strong>
        <span className="text-[12px] leading-tight text-[#52644f]">{cityName} · ${coins}</span>
      </span>
      <span className="shrink-0 text-[12px] tabular-nums text-[#263630]" aria-label={`Game time ${timeLabel}`}>◷ {timeLabel}</span>
    </button>
  </aside>;
}
