import { useCallback, useEffect, useRef, useState } from 'react';
import type { WorldClockSnapshot } from '@life-abroad/shared';
import type { SessionManager } from '../../types/session';
import { loadWorldClock } from './world-clock-api';
import { createWorldClockSync, interpolateWorldTime, type ReceivedWorldClock } from './world-clock';

export function useWorldClock(run: SessionManager['run'], enabled: boolean) {
  const [received, setReceived] = useState<ReceivedWorldClock | null>(null);
  const [displayNow, setDisplayNow] = useState(() => performance.now());
  const sync = useRef<ReturnType<typeof createWorldClockSync> | null>(null);
  const load = useCallback((): Promise<WorldClockSnapshot> => run(loadWorldClock), [run]);

  useEffect(() => {
    if (!enabled) { setReceived(null); return; }
    const controller = createWorldClockSync({
      load,
      performanceNow: () => performance.now(),
      isOnline: () => navigator.onLine,
      isHidden: () => document.hidden,
      setInterval: (callback, delay) => window.setInterval(callback, delay),
      clearInterval: id => window.clearInterval(id),
      addEventListener: (name, callback) => (name === 'online' ? window : document).addEventListener(name, callback),
      removeEventListener: (name, callback) => (name === 'online' ? window : document).removeEventListener(name, callback),
      publish: value => { setReceived(value); setDisplayNow(value.receivedAt); },
    });
    sync.current = controller;
    void controller.start();
    const displayTimer = window.setInterval(() => setDisplayNow(performance.now()), 1_000);
    return () => { controller.dispose(); sync.current = null; window.clearInterval(displayTimer); };
  }, [enabled, load]);

  const refresh = useCallback(async () => { await sync.current?.refresh().catch(() => undefined); }, []);
  return {
    snapshot: received?.snapshot ?? null,
    time: received ? interpolateWorldTime(received.snapshot, received.receivedAt, displayNow) : null,
    timeZone: received?.snapshot.timeZone ?? null,
    clockRate: received?.snapshot.clockRate ?? 1,
    revision: received?.receivedAt ?? 0,
    refresh,
  };
}
