import type { OverlayButtonProps } from '../types/ui/gameplay';
export function OverlayButton({ label, icon, onClick }: OverlayButtonProps) {
  return <button type="button" className="overlay-button w-11 h-11 rounded-[22px] bg-[var(--color-dialogue-overlay-strong)] [border:1px_solid_var(--color-overlay-border)] text-ink text-[20px] [@media(max-width:479px)]:text-[18px]" aria-label={label} onClick={onClick}><span aria-hidden="true">{icon}</span></button>;
}
