import { useCallback, useEffect, useRef, useState } from 'react';
import type { LifeState, ShopItem } from '@life-abroad/shared';
import type { SessionManager } from '../../types/session';
import { loadCatalog, loadLife, performLifeAction, type LifeAction } from './life-api';
import { isDefiniteRejection } from './life-clock';
import { runQuickRestTransition, type QuickRestPhase } from './quick-rest-transition';
import { refreshLifeOnConnection } from './life-sync';
export function useLife(run: SessionManager['run'], online: boolean) {
  const [state, setState] = useState<LifeState | null>(null);
  const [catalog, setCatalog] = useState<ShopItem[]>([]);
  const [pending, setPending] = useState(false);
  const [sleepTransition, setSleepTransition] = useState<QuickRestPhase>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState<LifeAction | null>(null);
  const mounted = useRef(false);
  const busy = useRef(false);
  const refresh = useCallback(async () => {
    try {
      const result = await run(loadLife);
      if (mounted.current) { setState(result); setError(''); }
    } catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : 'Unable to load saved life.'); }
  }, [run]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    void refreshLifeOnConnection(online, refresh, async () => {
      try { const result = await run(loadCatalog); if (mounted.current) setCatalog(result); }
      catch { if (mounted.current) setError('Unable to load shop catalog. Reconnect and refresh.'); }
    });
  }, [online, refresh, run]);
  const act = async (action: LifeAction) => {
    if (busy.current || !online) return;
    busy.current = true; setPending(true); setError('');
    const sleeping = action.path === 'sleep';
    const wait = (milliseconds: number) => new Promise<void>(resolve => window.setTimeout(resolve, milliseconds));
    try {
      const perform = () => run(token => performLifeAction(token, action));
      const result = sleeping
        ? await runQuickRestTransition({ request: perform,
            onPhase: phase => { if (mounted.current) setSleepTransition(phase); }, wait,
            reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches })
        : await perform();
      if (mounted.current) setState(result);
      if (mounted.current) setRetry(null);
      await refresh();
    } catch (failure) {
      if (mounted.current) {
        setRetry(isDefiniteRejection(failure) ? null : action);
        setError(failure instanceof Error ? failure.message : 'The result is uncertain. Retry the same action to check it safely.');
      }
    } finally {
      busy.current = false;
      if (mounted.current) { setPending(false); setSleepTransition(null); }
    }
  };
  const reload = async () => {
    await refresh();
    try { const result = await run(loadCatalog); if (mounted.current) setCatalog(result); }
    catch { if (mounted.current) setError('Unable to load shop catalog.'); }
  };
  return { state, catalog, pending, sleepTransition, error, retry, act, refresh, reload };
}
export type LifeControls = ReturnType<typeof useLife>;
