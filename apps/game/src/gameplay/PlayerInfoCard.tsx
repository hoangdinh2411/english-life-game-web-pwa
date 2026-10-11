import type { PlayerInfoCardProps } from '../types/ui/gameplay';
import { useEffect, useState } from 'react';
import { playerPortrait } from './portraits';
const GAME_TIME_RATE = 2;
function useGameClock() {
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  return new Date(startedAt + (now - startedAt) * GAME_TIME_RATE);
}
export function PlayerInfoCard({ playerName, cityName, xp, coins, visible = true, timeZone }: PlayerInfoCardProps) {
  const gameTime = useGameClock();
  const resolvedTimeZone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timeLabel = new Intl.DateTimeFormat(undefined, { timeZone: resolvedTimeZone, hour: '2-digit', minute: '2-digit' }).format(gameTime);
  const zoneLabel = new Intl.DateTimeFormat(undefined, { timeZone: resolvedTimeZone, timeZoneName: 'short' }).formatToParts(gameTime).find((part) => part.type === 'timeZoneName')?.value ?? '';
  return <aside hidden={!visible} className="player-card" aria-label={`Player ${playerName}, ${cityName}, ${coins} dollars, ${xp} XP. Local game time ${timeLabel} ${zoneLabel}, running at twice real time.`}>
    <img alt={`${playerName}'s avatar`} src={playerPortrait} width="44" height="44" />
    <div className="player-details"><strong className="truncate">{playerName}</strong><span className="truncate">{cityName}</span>
      <span aria-label={`${coins} dollars`} className="coins">$ {coins}</span><span>★ {xp} XP</span>
      <span aria-label={`Current time ${timeLabel} ${zoneLabel}, game runs twice as fast as real time`}>◷ {timeLabel} <b>2×</b></span>
    </div>
  </aside>;
}
