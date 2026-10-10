import type { GameButtonProps } from '../types/ui/gameplay';
export function GameButton({ label, ariaLabel, onClick, disabled = false }: GameButtonProps) {
  return <button type="button" className="game-button" aria-label={ariaLabel ?? label} disabled={disabled} onClick={onClick}>{label}</button>;
}
