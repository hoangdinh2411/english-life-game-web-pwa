import type { PlayerInfoCardProps } from "../types/ui/gameplay";
import { PlayerPortrait } from "../features/appearance/PlayerPortrait";

export function PlayerInfoCard({
  gender,
  playerName,
  cityName,
  coins,
  idCard,
  visible = true,
  onOpenProfile,
}: PlayerInfoCardProps) {
  return (
    <aside
      hidden={!visible}
      className="player-card w-fit min-w-0 max-w-[13rem] [&[hidden]]:hidden sm:max-w-64"
    >
      <button
        type="button"
        className="pointer-events-auto flex h-11 w-full min-w-0 items-center gap-2 overflow-hidden rounded-lg border border-border/60 bg-[var(--color-dialogue-overlay-strong)] px-2 text-left text-ink shadow-sm hover:bg-card max-sm:size-10 max-sm:justify-center max-sm:rounded-full max-sm:border-0 max-sm:bg-transparent max-sm:p-0 max-sm:shadow-none"
        aria-label={`Open ${playerName}'s profile`}
        onClick={onOpenProfile}
      >
        {idCard?.photoUrl ? (
          <span className="relative size-8 shrink-0 overflow-hidden rounded-full border border-[var(--color-gold-border)] bg-[var(--color-cream-muted)] max-sm:size-10">
            <img
              src={idCard.photoUrl}
              alt=""
              className="absolute inset-0 size-full object-cover object-center"
            />
          </span>
        ) : (
          <PlayerPortrait
            gender={gender}
            className="size-8 shrink-0 rounded-full border border-[var(--color-gold-border)] max-sm:size-10"
          />
        )}

        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <strong className="hidden truncate text-xs font-bold leading-tight sm:block sm:text-sm">
            {playerName}
          </strong>

          <span className="hidden text-sm leading-tight text-[var(--color-hint)] sm:block lg:text-md">
            {cityName} · ${coins}
          </span>
        </span>
      </button>
    </aside>
  );
}
