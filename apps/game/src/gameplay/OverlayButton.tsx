import type { OverlayButtonProps } from '../types/ui/gameplay';
export function OverlayButton({ label, icon, onClick }: OverlayButtonProps) {
  return <button type="button" className="overlay-button grid size-8 place-items-center rounded-lg border border-[var(--color-overlay-border)] bg-[var(--color-dialogue-overlay-strong)] text-ink sm:size-9" aria-label={label} onClick={onClick}><span className="size-4 sm:size-5" aria-hidden="true">{icon}</span></button>;
}
