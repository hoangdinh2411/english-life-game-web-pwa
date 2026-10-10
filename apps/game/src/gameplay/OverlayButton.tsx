import type { OverlayButtonProps } from '../types/ui/gameplay';
export function OverlayButton({ label, icon, onClick }: OverlayButtonProps) {
  return <button type="button" className="overlay-button" aria-label={label} onClick={onClick}><span aria-hidden="true">{icon}</span></button>;
}
