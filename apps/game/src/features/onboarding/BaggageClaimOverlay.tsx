import type { BaggageClaimOverlayProps } from "../../types/ui/gameplay";

export function BaggageClaimOverlay({
  claiming,
  claimed,
  coinsGranted = 500,
  error,
  onClaim,
  onClose,
}: BaggageClaimOverlayProps) {
  const displayCoins = coinsGranted > 0 ? coinsGranted : 500;

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
            <p className="text-sm leading-relaxed text-[var(--color-muted)]">
              Your suitcase just arrived on the carousel along with your{" "}
              <strong className="text-[var(--color-ink)]">$500</strong> starter travel funds. Claim your baggage to unlock the exit to the Train Station.
            </p>
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
                disabled={claiming}
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
