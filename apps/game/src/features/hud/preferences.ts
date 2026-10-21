export interface Preferences {
  sound: boolean;
  speechRate: number;
  speechPitch: number;
}
type DeviceStorage = Pick<Storage, 'getItem' | 'setItem'>;
const key = 'life-abroad.preferences';
export const defaultPreferences: Preferences = { sound: true, speechRate: 1, speechPitch: 1 };

const bounds = {
  speechRate: { min: 0.75, max: 1.5 },
  speechPitch: { min: 0.75, max: 1.25 },
} as const;

function bounded(value: unknown, setting: keyof typeof bounds): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return defaultPreferences[setting];
  return Math.min(bounds[setting].max, Math.max(bounds[setting].min, value));
}

export function createPreferences(storage?: DeviceStorage) {
  let state = defaultPreferences;
  try {
    const saved: unknown = JSON.parse(storage?.getItem(key) ?? 'null');
    if (typeof saved === 'object' && saved !== null) {
      state = {
        sound: 'sound' in saved && typeof saved.sound === 'boolean' ? saved.sound : true,
        speechRate: bounded('speechRate' in saved ? saved.speechRate : undefined, 'speechRate'),
        speechPitch: bounded('speechPitch' in saved ? saved.speechPitch : undefined, 'speechPitch'),
      };
    }
  } catch { /* Storage can be blocked; device settings still work in memory. */ }
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    set: <Setting extends keyof Preferences>(setting: Setting, value: Preferences[Setting]) => {
      const nextValue = setting === 'speechRate' || setting === 'speechPitch'
        ? bounded(value, setting)
        : value;
      state = { ...state, [setting]: nextValue };
      try { storage?.setItem(key, JSON.stringify(state)); } catch { /* Retain the in-memory preference. */ }
      listeners.forEach(listener => listener());
    },
  };
}
