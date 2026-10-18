import { playerLocationSchema, type PlayerLocation } from '@life-abroad/shared';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface LocationSyncOptions {
  userId: string;
  initialLocation: PlayerLocation;
  storage: StorageLike;
  save: (location: PlayerLocation) => Promise<void>;
  delayMs?: number;
  schedule?: (callback: () => void, delayMs: number) => unknown;
  cancel?: (handle: unknown) => void;
}

const keyFor = (userId: string): string => `life-abroad.player-location.${userId}`;

export function readPendingPlayerLocation(userId: string, storage: StorageLike): PlayerLocation | null {
  try {
    const raw = storage.getItem(keyFor(userId));
    if (!raw) return null;
    const record: unknown = JSON.parse(raw);
    if (typeof record !== 'object' || record === null || !('location' in record)) return null;
    return playerLocationSchema.parse(record.location);
  } catch {
    storage.removeItem(keyFor(userId));
    return null;
  }
}

export function clearPendingPlayerLocation(userId: string, storage: StorageLike): void {
  try { storage.removeItem(keyFor(userId)); } catch { /* storage is optional */ }
}

function writePendingPlayerLocation(userId: string, location: PlayerLocation, storage: StorageLike): void {
  try { storage.setItem(keyFor(userId), JSON.stringify({ version: 1, location })); } catch { /* server sync still works */ }
}

function sameLocation(left: PlayerLocation, right: PlayerLocation): boolean {
  return left.mapId === right.mapId && left.placeId === right.placeId && left.x === right.x && left.y === right.y;
}

export function createPlayerLocationSync(options: LocationSyncOptions) {
  const schedule = options.schedule ?? ((callback, delayMs) => setTimeout(callback, delayMs));
  const cancel = options.cancel ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  let latest = options.initialLocation;
  let lastServerLocation = options.initialLocation;
  let timer: unknown = null;
  let inFlight: Promise<void> | null = null;

  const clearTimer = () => {
    if (timer !== null) cancel(timer);
    timer = null;
  };

  const flush = (): Promise<void> => {
    clearTimer();
    if (inFlight) return inFlight;
    const checkpoint = latest;
    inFlight = options.save(checkpoint).then(() => {
      lastServerLocation = checkpoint;
      if (sameLocation(latest, checkpoint)) clearPendingPlayerLocation(options.userId, options.storage);
      else timer = schedule(() => { void flush().catch(() => undefined); }, options.delayMs ?? 5000);
    }).finally(() => { inFlight = null; });
    return inFlight;
  };

  return {
    update(location: PlayerLocation): void {
      latest = location;
      writePendingPlayerLocation(options.userId, location, options.storage);
      clearTimer();
      const changedPlace = location.mapId !== lastServerLocation.mapId || location.placeId !== lastServerLocation.placeId;
      if (changedPlace) void flush().catch(() => undefined);
      else timer = schedule(() => { void flush().catch(() => undefined); }, options.delayMs ?? 5000);
    },
    flush,
    dispose(): void { clearTimer(); },
  };
}
