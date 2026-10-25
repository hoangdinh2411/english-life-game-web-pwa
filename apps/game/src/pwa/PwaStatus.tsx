import { usePwa } from './PwaProvider';
import type { PwaStatusProps } from '../types/ui/gameplay';

export function PwaStatus({ playing }: PwaStatusProps) {
  const pwa = usePwa();
  if (pwa.online && !pwa.offlineReady && !pwa.updateReady && !pwa.message && !pwa.canInstall) return null;
  return <aside className="pwa-status shrink-0 flex items-center gap-2 flex-wrap [padding:4px_max(12px,_env(safe-area-inset-left))] bg-[var(--color-success-surface)] text-[12px] leading-[1.4] [&_button]:bg-transparent [&_button]:[border:1px_solid_var(--color-border)] [&_button]:rounded-[8px] [&_button]:text-ink [&_button]:[padding:4px_10px]" aria-label="App status">
    <span role="status">{!pwa.online ? 'Offline · Saved progress needs a connection. Local practice is available.' : pwa.offlineReady ? 'Online · Local practice is ready offline.' : 'Online'}{pwa.message ? ` ${pwa.message}` : ''}</span>
    {pwa.canInstall ? <button type="button" onClick={() => void pwa.install()}>Install app</button> : null}
    {pwa.updateReady ? playing ? <span>Update ready. Open the game menu when you’re finished.</span> : <button type="button" onClick={() => void pwa.update()}>Reload to update</button> : null}
  </aside>;
}
