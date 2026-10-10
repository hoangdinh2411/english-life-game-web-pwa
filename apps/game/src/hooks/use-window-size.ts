import { useSyncExternalStore } from 'react';

let size = { width: window.innerWidth, height: window.visualViewport?.height ?? window.innerHeight };
function subscribe(listener: () => void) {
  const resize = () => {
    size = { width: window.innerWidth, height: window.visualViewport?.height ?? window.innerHeight };
    listener();
  };
  window.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('resize', resize);
  resize();
  return () => {
    window.removeEventListener('resize', resize);
    window.visualViewport?.removeEventListener('resize', resize);
  };
}
export function useWindowDimensions() {
  return useSyncExternalStore(subscribe, () => size);
}
