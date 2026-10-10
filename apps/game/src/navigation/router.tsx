import type { RedirectProps } from '../types/navigation';
import { useEffect, useSyncExternalStore } from 'react';

const navigationEvent = 'life-abroad:navigate';
function navigate(path: string, replace: boolean) {
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Expected an application route.');
  if (replace) window.history.replaceState(null, '', path);
  else window.history.pushState(null, '', path);
  window.dispatchEvent(new Event(navigationEvent));
}
export const router = {
  push: (path: string) => navigate(path, false),
  replace: (path: string) => navigate(path, true),
  back: () => window.history.back(),
};
function subscribe(listener: () => void) {
  window.addEventListener('popstate', listener);
  window.addEventListener(navigationEvent, listener);
  return () => {
    window.removeEventListener('popstate', listener);
    window.removeEventListener(navigationEvent, listener);
  };
}
export function usePath() {
  return useSyncExternalStore(subscribe, () => window.location.pathname.replace(/\/$/, '') || '/');
}
export function Redirect({ href }: RedirectProps) {
  useEffect(() => router.replace(href), [href]);
  return null;
}
