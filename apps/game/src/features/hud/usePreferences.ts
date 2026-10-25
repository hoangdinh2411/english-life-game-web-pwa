import { useSyncExternalStore } from 'react';
import * as api from '../../api/client';
import type { SessionManager } from '../../types/session';
import { createPreferences, defaultPreferences } from './preferences';
import { createSyncedPreferences, type PreferenceRemote } from './synced-preferences';

function deviceStorage(): Storage | undefined {
  try { return typeof window === 'undefined' ? undefined : window.localStorage; }
  catch { return undefined; }
}
const localPreferences = createPreferences(deviceStorage());
let authenticatedRemote: PreferenceRemote | null = null;
export const preferences = createSyncedPreferences(localPreferences, {
  load: () => authenticatedRemote?.load() ?? Promise.reject(new Error('Preference synchronization is not connected.')),
  initialize: value => authenticatedRemote?.initialize(value) ?? Promise.reject(new Error('Preference synchronization is not connected.')),
  update: value => authenticatedRemote?.update(value) ?? Promise.reject(new Error('Preference synchronization is not connected.')),
});

export function synchronizePreferences(runAuthenticated: SessionManager['run']): void {
  authenticatedRemote = {
    load: () => runAuthenticated(api.loadPlayerPreferences),
    initialize: value => runAuthenticated(token => api.initializePlayerPreferences(token, value)),
    update: value => runAuthenticated(token => api.updatePlayerPreferences(token, value)),
  };
  void preferences.start();
}

export function disablePreferenceSynchronization(): void {
  authenticatedRemote = null;
  preferences.stop();
}

export function usePreferences() {
  const state = useSyncExternalStore(preferences.subscribe, preferences.getSnapshot, () => ({ ...defaultPreferences, status: 'local' as const }));
  return { ...state, set: preferences.set, retry: preferences.retry };
}
