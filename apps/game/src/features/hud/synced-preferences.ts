import type {
  PlayerPreferences,
  PlayerPreferencesInitialize,
  PlayerPreferencesRead,
  PlayerPreferencesUpdate,
} from '@life-abroad/shared';
import type { Preferences } from './preferences';

export type PreferenceSyncStatus = 'local' | 'loading' | 'saved' | 'saving' | 'error';
export type SyncedPreferences = Preferences & { status: PreferenceSyncStatus };

interface LocalPreferencesStore {
  getSnapshot: () => Preferences;
  subscribe: (listener: () => void) => () => void;
  set: <Setting extends keyof Preferences>(setting: Setting, value: Preferences[Setting]) => void;
}

export interface PreferenceRemote {
  load: () => Promise<PlayerPreferencesRead>;
  initialize: (preferences: PlayerPreferencesInitialize) => Promise<PlayerPreferences>;
  update: (preferences: PlayerPreferencesUpdate) => Promise<PlayerPreferences>;
}

interface SyncOptions {
  debounceMs?: number;
}

const learningKeys = ['speechRate', 'speechPitch'] as const;

function learningValues(preferences: Preferences): PlayerPreferencesInitialize {
  return {
    speechRate: preferences.speechRate,
    speechPitch: preferences.speechPitch,
  };
}

export function createSyncedPreferences(
  local: LocalPreferencesStore,
  remote: PreferenceRemote,
  { debounceMs = 300 }: SyncOptions = {},
) {
  let status: PreferenceSyncStatus = 'local';
  let active = false;
  let loaded = false;
  let revision = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  let snapshot: SyncedPreferences = { ...local.getSnapshot(), status };

  const notify = () => listeners.forEach(listener => listener());
  const refreshSnapshot = () => {
    snapshot = { ...local.getSnapshot(), status };
    notify();
  };
  const setStatus = (next: PreferenceSyncStatus) => {
    if (status === next) return;
    status = next;
    refreshSnapshot();
  };
  const applyServer = (preferences: PlayerPreferences) => {
    for (const key of learningKeys) local.set(key, preferences[key]);
  };

  async function save(update: PlayerPreferencesUpdate, requestRevision: number): Promise<void> {
    setStatus('saving');
    try {
      await remote.update(update);
      if (active && revision === requestRevision) setStatus('saved');
    } catch {
      if (active && revision === requestRevision) setStatus('error');
    }
  }

  async function start(): Promise<void> {
    active = true;
    loaded = false;
    const requestRevision = ++revision;
    if (timer !== undefined) clearTimeout(timer);
    setStatus('loading');
    try {
      const result = await remote.load();
      if (!active || revision !== requestRevision) return;
      const preferences = result.preferences ?? await remote.initialize(learningValues(local.getSnapshot()));
      if (!active || revision !== requestRevision) return;
      applyServer(preferences);
      loaded = true;
      setStatus('saved');
    } catch {
      if (active && revision === requestRevision) setStatus('error');
    }
  }

  function stop(): void {
    active = false;
    loaded = false;
    revision += 1;
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    setStatus('local');
  }

  function set<Setting extends keyof Preferences>(setting: Setting, value: Preferences[Setting]): void {
    local.set(setting, value);
    if (setting === 'sound' || !active) return;
    const requestRevision = ++revision;
    const update = { [setting]: local.getSnapshot()[setting] } as PlayerPreferencesUpdate;
    if (timer !== undefined) clearTimeout(timer);
    setStatus('saving');
    timer = setTimeout(() => {
      timer = undefined;
      void save(update, requestRevision);
    }, debounceMs);
  }

  async function retry(): Promise<void> {
    if (!active) return;
    if (!loaded) return start();
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    const requestRevision = ++revision;
    await save(learningValues(local.getSnapshot()), requestRevision);
  }

  local.subscribe(refreshSnapshot);
  return {
    getSnapshot: (): SyncedPreferences => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    set,
    start,
    stop,
    retry,
  };
}
