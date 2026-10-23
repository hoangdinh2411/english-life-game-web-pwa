import type { WorldClockSnapshot } from '@life-abroad/shared';

export interface ReceivedWorldClock { snapshot: WorldClockSnapshot; receivedAt: number }

interface WorldClockSyncDependencies {
  load: () => Promise<WorldClockSnapshot>;
  performanceNow: () => number;
  isOnline: () => boolean;
  isHidden: () => boolean;
  setInterval: (callback: () => void, delay: number) => number;
  clearInterval: (id: number) => void;
  addEventListener: (name: 'online' | 'visibilitychange', callback: () => void) => void;
  removeEventListener: (name: 'online' | 'visibilitychange', callback: () => void) => void;
  publish: (value: ReceivedWorldClock) => void;
}

export function interpolateWorldTime(snapshot: WorldClockSnapshot, receivedAt: number, now: number): Date {
  return new Date(Date.parse(snapshot.gameTimeUtc) + Math.max(0, now - receivedAt) * snapshot.clockRate);
}

export function formatWorldTime(instant: Date, timeZone: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).format(instant);
}

export function localWorldMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.find(part => part.type === type)?.value);
  return value('hour') * 60 + value('minute');
}

export function createWorldClockSync(dependencies: WorldClockSyncDependencies) {
  let disposed = false;
  let intervalId: number | undefined;
  const refresh = async (): Promise<void> => {
    if (disposed || !dependencies.isOnline()) return;
    const snapshot = await dependencies.load();
    if (!disposed) dependencies.publish({ snapshot, receivedAt: dependencies.performanceNow() });
  };
  const reconnect = (): Promise<void> => refresh().catch(() => undefined);
  const visible = (): Promise<void> => dependencies.isHidden() ? Promise.resolve() : reconnect();
  return {
    refresh,
    start: async (): Promise<void> => {
      dependencies.addEventListener('online', reconnect);
      dependencies.addEventListener('visibilitychange', visible);
      intervalId = dependencies.setInterval(() => { void reconnect(); }, 60_000);
      await reconnect();
    },
    dispose: (): void => {
      disposed = true;
      if (intervalId !== undefined) dependencies.clearInterval(intervalId);
      dependencies.removeEventListener('online', reconnect);
      dependencies.removeEventListener('visibilitychange', visible);
    },
  };
}
