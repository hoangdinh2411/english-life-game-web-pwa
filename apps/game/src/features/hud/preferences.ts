export interface Preferences { sound: boolean; coach: boolean }
type DeviceStorage = Pick<Storage, 'getItem' | 'setItem'>;
const key = 'life-abroad.preferences';
export const defaultPreferences: Preferences = { sound: true, coach: false };

export function createPreferences(storage?: DeviceStorage) {
  let state = defaultPreferences;
  try {
    const saved: unknown = JSON.parse(storage?.getItem(key) ?? 'null');
    if (typeof saved === 'object' && saved !== null) {
      state = { sound: 'sound' in saved && typeof saved.sound === 'boolean' ? saved.sound : true,
        coach: 'coach' in saved && typeof saved.coach === 'boolean' ? saved.coach : false };
    }
  } catch { /* Storage can be blocked; device settings still work in memory. */ }
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    set: (setting: keyof Preferences, value: boolean) => {
      state = { ...state, [setting]: value };
      try { storage?.setItem(key, JSON.stringify(state)); } catch { /* Retain the in-memory preference. */ }
      listeners.forEach(listener => listener());
    },
  };
}
