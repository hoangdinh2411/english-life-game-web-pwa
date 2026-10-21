import { useSyncExternalStore } from 'react';
import { createPreferences, defaultPreferences } from './preferences';

function deviceStorage(): Storage | undefined {
  try { return typeof window === 'undefined' ? undefined : window.localStorage; }
  catch { return undefined; }
}
export const preferences = createPreferences(deviceStorage());
export function usePreferences() {
  const state = useSyncExternalStore(preferences.subscribe, preferences.getSnapshot, () => defaultPreferences);
  return { ...state, set: preferences.set };
}
