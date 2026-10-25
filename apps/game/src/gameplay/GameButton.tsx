import type { GameButtonProps } from '../types/ui/gameplay';
export function GameButton({ label, ariaLabel, onClick, disabled = false }: GameButtonProps) {
  return <button type="button" className="game-button min-h-11 [padding:10px_16px] border-0 rounded-[12px] bg-[var(--color-green-strong)] text-[var(--color-cream-text)] text-[15px] font-bold" aria-label={ariaLabel ?? label} disabled={disabled} onClick={onClick}>{label}</button>;
}
