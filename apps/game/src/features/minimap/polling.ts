import type { MinimapSnapshot } from './model';

type Visibility = Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>;
type Timer = Pick<Window, 'setInterval' | 'clearInterval'>;

// The scene owns the source. Pull only while the minimap and browser tab are visible.
export function observeMinimap(read: () => MinimapSnapshot | null, publish: (snapshot: MinimapSnapshot | null) => void, visibility: Visibility, timer: Timer): () => void {
  let interval: number | undefined;
  const stop = () => { if (interval !== undefined) timer.clearInterval(interval); interval = undefined; };
  const update = () => publish(read());
  const resume = () => {
    stop();
    if (visibility.hidden) return;
    update();
    interval = timer.setInterval(update, 100);
  };
  visibility.addEventListener('visibilitychange', resume);
  resume();
  return () => { stop(); visibility.removeEventListener('visibilitychange', resume); };
}
