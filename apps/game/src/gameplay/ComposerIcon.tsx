import type { ComposerIconProps } from '../types/ui/gameplay';
export function ComposerIcon({ kind, color }: ComposerIconProps) {
  return <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {kind === 'microphone' ? <><rect x="8" y="1" width="8" height="13" rx="4" /><path d="M4 9v2a8 8 0 0 0 16 0V9M12 19v4M8 23h8" /></> :
      kind === 'send' ? <path d="M12 21V4M6 10l6-6 6 6" /> : <rect x="5" y="5" width="14" height="14" rx="2" fill={color} />}
  </svg>;
}
