import type { AvatarPreviewProps, ChoiceCardProps, ActionButtonProps, HeadingProps } from '../types/ui/onboarding';
import type { PropsWithChildren } from 'react';
export function Screen({ children }: PropsWithChildren) {
  return <main className="onboarding"><div className="onboarding-content">{children}</div></main>;
}
export function Heading({ title, subtitle }: HeadingProps) {
  return <header className="heading"><h1 tabIndex={-1}>{title}</h1>{subtitle ? <p>{subtitle}</p> : null}</header>;
}
export function ActionButton({ label, onClick, disabled = false, secondary = false }: ActionButtonProps) {
  return <button type="button" className={secondary ? 'action-button secondary' : 'action-button'} disabled={disabled} onClick={onClick}>{label}</button>;
}
export function ChoiceCard({ title, subtitle, selected, onClick, children }: ChoiceCardProps) {
  return <button type="button" className={selected ? 'choice-card selected' : 'choice-card'} aria-pressed={selected} onClick={onClick}>
    {children}<span className="card-copy"><strong>{title}</strong>{subtitle ? <span>{subtitle}</span> : null}</span>
    <span className="choice-mark" aria-hidden="true">{selected ? '●' : '○'}</span>
  </button>;
}
export function AvatarPreview({ color, large = false }: AvatarPreviewProps) {
  return <span role="img" aria-label="Pixel character preview" className={large ? 'avatar-preview large' : 'avatar-preview'}>
    <span className="avatar-hair" /><span className="avatar-face"><span /><span /></span>
    <span className="avatar-body" style={{ backgroundColor: color }} /><span className="avatar-legs"><span /><span /></span>
  </span>;
}
