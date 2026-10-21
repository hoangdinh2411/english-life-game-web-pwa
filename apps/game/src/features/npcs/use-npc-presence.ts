import { useCallback, useEffect, useState } from 'react';
import { loadNpcPresence } from '../../api/client';
import { useSession } from '../../session/session-provider';

export function useNpcPresence(mapId: string, enabled: boolean, online: boolean, clockRate: number) {
  const { runAuthenticated: run } = useSession();
  const [presentNpcIds, setPresentNpcIds] = useState<readonly string[]>([]);
  const refresh = useCallback(async () => {
    if (!enabled || !online) { setPresentNpcIds([]); return; }
    try {
      const presence = await run(token => loadNpcPresence(token, mapId));
      setPresentNpcIds(presence.presentNpcIds);
      return presence;
    } catch {
      setPresentNpcIds([]);
      return undefined;
    }
  }, [enabled, mapId, online, run]);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const schedule = async (): Promise<void> => {
      const result = await refresh();
      if (cancelled) return;
      const gameDelay = result?.nextChangeAt ? Date.parse(result.nextChangeAt) - Date.parse(result.gameTime) : 15 * 60_000;
      const realDelay = Math.max(1_000, Math.min(15 * 60_000, gameDelay / Math.max(1, clockRate)));
      timer = window.setTimeout(() => { void schedule(); }, realDelay + 250);
    };
    void schedule();
    return () => { cancelled = true; if (timer !== undefined) window.clearTimeout(timer); };
  }, [clockRate, refresh]);

  return { presentNpcIds, refresh };
}
