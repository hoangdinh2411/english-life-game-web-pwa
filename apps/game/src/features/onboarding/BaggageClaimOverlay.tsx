import type { BaggageClaimOverlayProps } from "../../types/ui/gameplay";
import { AIRPORT_CAROUSEL_SUITCASES, resolveCarouselSuitcase } from "../../gameplay/station-navigation";

export function BaggageClaimOverlay({
  claiming,
  claimed,
  coinsGranted = 500,
  playerName,
  targetSuitcaseId,
  selectedSuitcaseId,
  onSelectSuitcase,
  error,
  onClaim,
  onClose,
}: BaggageClaimOverlayProps) {
  const displayCoins = coinsGranted > 0 ? coinsGranted : 500;
  const ownerLabel = playerName?.trim() || "Traveler";
  const targetSuitcase = resolveCarouselSuitcase(targetSuitcaseId);
  const selectedId = selectedSuitcaseId ?? null;
  const requiresMatch = Boolean(onSelectSuitcase);
  const isMatched = !requiresMatch || selectedId === targetSuitcase.id;
  const isWrongSelection = requiresMatch && selectedId !== null && selectedId !== targetSuitcase.id;

  return (
    <div
      className="baggage-claim-overlay fixed inset-0 z-[1000] grid place-items-center bg-[var(--color-shadow)] p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Baggage Claim"
    >
      <div className="w-full max-w-md rounded-2xl border-2 border-[var(--color-border)] bg-[var(--color-card)] p-6 text-[var(--color-ink)] shadow-[0_12px_32px_var(--color-shadow)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
              Arrival Terminal · Carousel 1
            </p>
            <h2 className="mt-1 text-xl font-bold text-[var(--color-ink)]">
              {claimed ? "Baggage Claimed!" : "Collect Your Baggage"}
            </h2>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close baggage claim"
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)] px-2.5 py-1 text-sm font-semibold text-[var(--color-ink)] hover:bg-[var(--color-cream-muted)]"
            >
              ×
            </button>
          ) : null}
        </div>

        {claimed ? (
          <div className="mt-4 space-y-4">
            <div
              className="rounded-xl border border-[var(--color-gold-border)] bg-[var(--color-success-surface)] p-4 text-center"
              role="status"
            >
              <p className="text-sm font-semibold text-[var(--color-message-strong)]">
                Starter Funds Received
              </p>
              <p className="mt-1 text-3xl font-extrabold text-[var(--color-green-deep)]">
                +${displayCoins}
              </p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                Your luggage and travel allowance are ready. Head to the exit to reach the Train Station.
              </p>
            </div>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl bg-[var(--color-green)] px-4 py-2.5 text-sm font-bold text-[var(--color-cream-text-pure)] hover:bg-[var(--color-green-strong)]"
              >
                Continue
              </button>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-[var(--color-gold-border)] bg-[var(--color-dialogue)] p-3 text-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-green-strong)]">
                Your Baggage Tag · #LA-204
              </p>
              <p className="mt-1 text-[var(--color-ink)]">
                Passenger: <strong>{ownerLabel}</strong>
              </p>
              <p className="text-[var(--color-ink)]">
                Luggage: <strong>{targetSuitcase.label}</strong> (includes <strong>$500</strong> starter funds)
              </p>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-[var(--color-muted)]">
                Check your baggage tag and pick your suitcase from the carousel:
              </p>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Suitcases on carousel">
                {AIRPORT_CAROUSEL_SUITCASES.map((bag) => {
                  const selected = selectedId === bag.id;
                  return (
                    <button
                      key={bag.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={claiming}
                      onClick={() => onSelectSuitcase?.(bag.id)}
                      className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                        selected
                          ? bag.id === targetSuitcase.id
                            ? "border-[var(--color-green-strong)] bg-[var(--color-success-surface)] text-[var(--color-green-deep)]"
                            : "border-[var(--color-warning)] bg-[var(--color-practice-surface)] text-[var(--color-warning)]"
                          : "border-[var(--color-border)] bg-[var(--color-paper)] text-[var(--color-ink)] hover:bg-[var(--color-cream-muted)]"
                      }`}
                    >
                      <span aria-hidden="true">{bag.swatch}</span>
                      <span>{bag.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {isWrongSelection ? (
              <p
                className="rounded-lg border border-[var(--color-warning)] bg-[var(--color-practice-surface)] px-3 py-2 text-xs font-medium text-[var(--color-warning)]"
                role="status"
              >
                That&apos;s not yours — check the color on your baggage tag!
              </p>
            ) : requiresMatch && isMatched ? (
              <p
                className="rounded-lg border border-[var(--color-green-strong)] bg-[var(--color-success-surface-alt)] px-3 py-2 text-xs font-semibold text-[var(--color-green-strong)]"
                role="status"
              >
                Tag #LA-204 matched! Ready to collect your {targetSuitcase.label.toLowerCase()}.
              </p>
            ) : null}

            {error ? (
              <p
                className="rounded-lg border border-[var(--color-warning)] bg-[var(--color-practice-surface)] px-3 py-2 text-xs font-medium text-[var(--color-warning)]"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={onClaim}
                disabled={claiming || !isMatched}
                className="flex-1 rounded-xl bg-[var(--color-green)] px-4 py-2.5 text-sm font-bold text-[var(--color-cream-text-pure)] hover:bg-[var(--color-green-strong)] disabled:cursor-not-allowed disabled:bg-[var(--color-disabled-surface)] disabled:text-[var(--color-muted)]"
              >
                {claiming ? "Claiming…" : "Claim Baggage ($500)"}
              </button>
              {onClose ? (
                <button
                  type="button"
                  onClick={onClose}
                  disabled={claiming}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-paper)] px-4 py-2.5 text-sm font-semibold text-[var(--color-ink)] hover:bg-[var(--color-cream-muted)] disabled:opacity-60"
                >
                  Later
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
