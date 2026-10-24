import type { ActionButtonProps, HeadingProps } from '../types/ui/onboarding';
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
