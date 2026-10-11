import { useCallback, useEffect, useRef, useState } from 'react';
import type { LifeState, ShopItem } from '@life-abroad/shared';
import type { SessionManager } from '../../types/session';
import { loadCatalog, loadLife, performLifeAction, type LifeAction } from './life-api';
import { isDefiniteRejection, savedGameTime } from './life-clock';
export function useLife(run: SessionManager['run'], online: boolean) {
  const [state, setState] = useState<LifeState | null>(null);
  const [catalog, setCatalog] = useState<ShopItem[]>([]);
  const [pending, setPending] = useState(false);
  const [sleepTransition, setSleepTransition] = useState<'darkening' | 'waking' | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState<LifeAction | null>(null);
  const [now, setNow] = useState(Date.now());
  const receivedAt = useRef(Date.now());
  const mounted = useRef(false);
  const busy = useRef(false);
  const refresh = useCallback(async () => {
    try {
      const result = await run(loadLife);
      if (mounted.current) { receivedAt.current = Date.now(); setNow(receivedAt.current); setState(result); setError(''); }
    } catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : 'Unable to load saved life.'); }
  }, [run]);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    void run(loadCatalog).then(result => { if (mounted.current) setCatalog(result); }).catch(() => { if (mounted.current) setError('Unable to load shop catalog. Reconnect and refresh.'); });
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { mounted.current = false; window.clearInterval(interval); };
  }, [run, refresh]);
  const act = async (action: LifeAction) => {
    if (busy.current || !online) return;
    busy.current = true; setPending(true); setError('');
    const sleeping = action.path === 'sleep';
    const wait = () => new Promise<void>(resolve => window.setTimeout(resolve, 2000));
    try {
      if (sleeping) { setSleepTransition('darkening'); await wait(); }
      if (!mounted.current) return;
      await run(token => performLifeAction(token, action));
      if (mounted.current) setRetry(null);
      if (sleeping && mounted.current) { setSleepTransition('waking'); await wait(); }
      await refresh();
    } catch (failure) {
      if (sleeping && mounted.current) { setSleepTransition('waking'); await wait(); }
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
  return { state, catalog, pending, sleepTransition, error, retry, act, refresh, reload,
    time: state ? savedGameTime(state, receivedAt.current, now) : null };
}
export type LifeControls = ReturnType<typeof useLife>;
