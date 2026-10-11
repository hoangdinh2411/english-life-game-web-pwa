import type { OverlayButtonProps } from '../types/ui/gameplay';
export function OverlayButton({ label, icon, onClick }: OverlayButtonProps) {
  return <button type="button" className="overlay-button w-11 h-11 rounded-[22px] bg-[rgba(255,_248,_233,_0.97)] [border:1px_solid_#9b8c70] text-ink text-[20px] [@media(max-width:479px)]:text-[18px]" aria-label={label} onClick={onClick}><span aria-hidden="true">{icon}</span></button>;
}
