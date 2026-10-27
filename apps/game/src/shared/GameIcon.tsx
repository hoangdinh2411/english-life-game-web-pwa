import type { ReactNode, SVGProps } from 'react';

export type GameIconName =
  | 'arrow-left' | 'book' | 'check' | 'clock' | 'compass' | 'goals'
  | 'logout' | 'map' | 'menu' | 'play' | 'refresh' | 'settings'
  | 'sound-off' | 'sound-on' | 'x';

interface GameIconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  name: GameIconName;
}

const paths: Record<GameIconName, ReactNode> = {
  'arrow-left': <><path d="M19 12H5" /><path d="m11 18-6-6 6-6" /></>,
  book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5Z" /><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5Z" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5Z" /></>,
  goals: <><path d="M6 4h12v17l-6-3-6 3Z" /><path d="M9 8h6M9 12h4" /></>,
  logout: <><path d="M10 5H5v14h5" /><path d="M13 8l4 4-4 4M17 12H9" /></>,
  map: <><path d="m3 6 5-3 8 3 5-3v15l-5 3-8-3-5 3Z" /><path d="M8 3v15M16 6v15" /></>,
  menu: <path d="M5 7h14M5 12h14M5 17h14" />,
  play: <path d="m8 5 11 7-11 7Z" />,
  refresh: <><path d="M20 7v5h-5" /><path d="M18.5 17a8 8 0 1 1 .8-9" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" /></>,
  'sound-off': <><path d="M5 10v4h4l5 4V6l-5 4Z" /><path d="m18 9 4 4M22 9l-4 4" /></>,
  'sound-on': <><path d="M5 10v4h4l5 4V6l-5 4Z" /><path d="M17 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12" /></>,
  x: <path d="m6 6 12 12M18 6 6 18" />,
};

export function GameIcon({ name, ...props }: GameIconProps) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" focusable="false" {...props}>{paths[name]}</svg>;
}
