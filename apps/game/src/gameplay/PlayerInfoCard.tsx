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
      className="player-card [grid-column:1] [grid-row:1] min-w-0 w-fit lg:[grid-column:1] lg:[grid-row:1] lg:max-w-[260px] [&[hidden]]:hidden"
    >
      <button
        type="button"
        className="pointer-events-auto flex min-h-14 w-full min-w-0 items-center gap-2 overflow-hidden rounded-[14px] border-2 border-border bg-[var(--color-dialogue-overlay-strong)]  p-2 pr-4  text-left text-ink shadow-[0_2px_6px_var(--color-shadow)] hover:bg-[var(--color-card)] lg:flex"
        aria-label={`Open ${playerName}'s profile`}
        onClick={onOpenProfile}
      >
        <PlayerPortrait
          gender={gender}
          className="size-9 lg:size-10 rounded-full [border:1px_solid_var(--color-border)]"
        />

        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <strong className="truncate text-sm lg:text-md leading-tight">
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
