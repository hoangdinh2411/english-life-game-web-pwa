import type { AvatarPreviewProps, ChoiceCardProps, ActionButtonProps, HeadingProps } from '../types/ui/onboarding';
import type { PropsWithChildren } from 'react';
export function Screen({ children }: PropsWithChildren) {
  return <main className="onboarding flex-1 min-h-0 overflow-auto p-5 bg-paper [@media(max-width:479px)]:p-4"><div className="onboarding-content flex flex-col gap-4 w-full max-w-[560px] m-auto [padding:24px_0_48px]">{children}</div></main>;
}
export function Heading({ title, subtitle }: HeadingProps) {
  return <header className="heading flex flex-col gap-1.5 mb-1 [&_h1]:text-[30px] [&_h1]:font-extrabold [&_h1]:leading-[1.2] [&_p]:text-muted [&_p]:text-[16px] [&_p]:leading-[1.45]"><h1 tabIndex={-1}>{title}</h1>{subtitle ? <p>{subtitle}</p> : null}</header>;
}
export function ActionButton({ label, onClick, disabled = false, secondary = false }: ActionButtonProps) {
  return <button type="button" className={`action-button min-h-[54px] text-white text-[17px] font-extrabold [border:2px_solid_transparent] rounded-[16px] [padding:12px_24px] bg-green [&.secondary]:bg-transparent [&.secondary]:border-border [&.secondary]:text-ink ${secondary ? "secondary" : ""}`} disabled={disabled} onClick={onClick}>{label}</button>;
}
export function ChoiceCard({ title, subtitle, selected, onClick, children }: ChoiceCardProps) {
  return <button type="button" className={`choice-card flex items-center gap-3.5 text-left min-h-[116px] [border:2px_solid_var(--color-border)] rounded-[20px] bg-card p-4 text-ink [&.selected]:border-green [&.selected]:bg-[#edf3e9] [@media(max-width:479px)]:p-3 [@media(max-width:479px)]:gap-2.5 ${selected ? "selected" : ""}`} aria-pressed={selected} onClick={onClick}>
    {children}<span className="card-copy flex-1 min-w-0 flex flex-col gap-1 [overflow-wrap:anywhere] [&_strong]:text-[19px] [&_>_span]:text-muted [&_>_span]:text-[14px] [&_>_span]:leading-[1.45]"><strong>{title}</strong>{subtitle ? <span>{subtitle}</span> : null}</span>
    <span className="choice-mark text-[26px] shrink-0 text-green" aria-hidden="true">{selected ? '●' : '○'}</span>
  </button>;
}
export function AvatarPreview({ color, large = false }: AvatarPreviewProps) {
  return <span role="img" aria-label="Pixel character preview" className={`avatar-preview inline-flex relative w-18 h-20 shrink-0 flex-col items-center justify-end pb-1 [&.large]:[transform:scale(1.5)] [&.large]:[margin:16px_28px] ${large ? "large" : ""}`}>
    <span className="avatar-hair absolute top-2 w-9 h-[26px] bg-[#594637] rounded-[8px]" /><span className="avatar-face absolute [top:15px] w-[30px] h-[26px] bg-[#efc69c] rounded-[6px] flex items-center justify-evenly [&_span]:w-[3px] [&_span]:h-1 [&_span]:bg-ink"><span /><span /></span>
    <span className="avatar-body w-[38px] h-[26px] rounded-[5px] [border:3px_solid_#d8b997]" style={{ backgroundColor: color }} /><span className="avatar-legs w-[26px] h-[15px] flex justify-between [&_span]:w-2.5 [&_span]:h-3 [&_span]:bg-[#52615a] [&_span]:[border-bottom:3px_solid_#3b403b]"><span /><span /></span>
  </span>;
}
