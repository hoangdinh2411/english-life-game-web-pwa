import { usePwa } from './PwaProvider';
import type { PwaStatusProps } from '../types/ui/gameplay';

export function PwaStatus({ playing }: PwaStatusProps) {
  const pwa = usePwa();
  if (pwa.online && !pwa.offlineReady && !pwa.updateReady && !pwa.message && !pwa.canInstall) return null;
  return <aside className="pwa-status" aria-label="App status">
    <span role="status">{!pwa.online ? 'Offline · Local practice only. Saved progress needs a connection.' : pwa.offlineReady ? 'Online · Local practice is ready offline.' : 'Online'}{pwa.message ? ` ${pwa.message}` : ''}</span>
    {pwa.canInstall ? <button type="button" onClick={() => void pwa.install()}>Install app</button> : null}
    {pwa.updateReady ? playing ? <span>Update ready. Open the game menu when you’re finished.</span> : <button type="button" onClick={() => void pwa.update()}>Reload to update</button> : null}
  </aside>;
}
