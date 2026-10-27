import type { GameButtonProps } from '../types/ui/gameplay';
export function GameButton({ label, ariaLabel, icon, onClick, disabled = false }: GameButtonProps) {
  return <button type="button" className="game-button inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border-0 bg-[var(--color-green-strong)] px-3 py-1.5 text-sm font-bold text-[var(--color-cream-text)]" aria-label={ariaLabel ?? label} disabled={disabled} onClick={onClick}>{icon ? <span className="size-4 shrink-0" aria-hidden="true">{icon}</span> : null}<span>{label}</span></button>;
}
