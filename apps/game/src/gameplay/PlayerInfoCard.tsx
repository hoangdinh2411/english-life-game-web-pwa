import type { PlayerInfoCardProps } from "../types/ui/gameplay";
import { PlayerPortrait } from "../features/appearance/PlayerPortrait";

export function PlayerInfoCard({
  gender,
  playerName,
  cityName,
  coins,
  visible = true,
  onOpenProfile,
}: PlayerInfoCardProps) {
  return (
    <aside
      hidden={!visible}
      className="player-card w-fit min-w-0 max-w-52 [&[hidden]]:hidden sm:max-w-64"
    >
      <button
        type="button"
        className="pointer-events-auto flex h-11 w-full min-w-0 items-center gap-2 overflow-hidden rounded-lg border border-border/60 bg-[var(--color-dialogue-overlay-strong)] px-2 text-left text-ink shadow-sm hover:bg-card"
        aria-label={`Open ${playerName}'s profile`}
        onClick={onOpenProfile}
      >
        <PlayerPortrait
          gender={gender}
          className="size-8 rounded-full border border-border/60"
        />

        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <strong className="truncate text-xs font-bold leading-tight sm:text-sm">
            {playerName}
          </strong>

          <span className="text-sm lg:text-md leading-tight text-[var(--color-hint)]">
            {cityName} · ${coins}
          </span>
        </span>
      </button>
    </aside>
  );
}
