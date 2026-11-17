import type { PlayerInfoCardProps } from "../types/ui/gameplay";
import { PlayerPortrait } from "../features/appearance/PlayerPortrait";

export function PlayerInfoCard({
  gender,
  playerName,
  cityName,
  coins,
  idCard,
  userMode = "adult",
  visible = true,
  onOpenProfile,
}: PlayerInfoCardProps) {
  const isKid = userMode === "kid";
  const starsCount = Math.max(0, Math.floor(coins / 5));

  return (
    <aside
      hidden={!visible}
      className={`player-card w-fit min-w-0 [&[hidden]]:hidden ${
        isKid ? "max-w-[15rem] sm:max-w-72" : "max-w-[13rem] sm:max-w-64"
      }`}
    >
      <button
        type="button"
        className={`pointer-events-auto flex h-11 w-full min-w-0 items-center gap-2 overflow-hidden rounded-xl border text-left text-ink shadow-sm transition-all hover:bg-card max-sm:size-10 max-sm:justify-center max-sm:rounded-full max-sm:border-0 max-sm:bg-transparent max-sm:p-0 max-sm:shadow-none ${
          isKid
            ? "border-[var(--color-gold-border)] bg-[var(--color-cream-muted)] px-2.5"
            : "border-border/60 bg-[var(--color-dialogue-overlay-strong)] px-2"
        }`}
        aria-label={isKid ? `Open ${playerName}'s profile (${starsCount} stars)` : `Open ${playerName}'s profile`}
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
            className={`size-8 shrink-0 rounded-full border max-sm:size-10 ${
              isKid ? "border-[var(--color-gold-border)] ring-2 ring-[var(--color-gold)]" : "border-[var(--color-gold-border)]"
            }`}
          />
        )}

        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <strong className="hidden truncate text-xs font-bold leading-tight sm:block sm:text-sm">
            {playerName}
          </strong>

          {isKid ? (
            <span className="hidden items-center gap-1.5 text-xs font-bold leading-tight text-ink sm:flex">
              <span className="inline-flex items-center text-[var(--color-warning)] font-extrabold" aria-label={`${starsCount} stars`}>
                ⭐ {starsCount}
              </span>
              <span className="text-[var(--color-hint)] font-normal">· 😊 Joyful</span>
            </span>
          ) : (
            <span className="hidden text-sm leading-tight text-[var(--color-hint)] sm:block lg:text-md">
              {cityName} · ${coins} {idCard ? <span className="ml-1 rounded bg-[var(--color-success-surface-alt)] px-1 py-0.5 text-[10px] font-bold text-[var(--color-green-strong)]">CEFR</span> : null}
            </span>
          )}
        </span>
      </button>
    </aside>
  );
}
