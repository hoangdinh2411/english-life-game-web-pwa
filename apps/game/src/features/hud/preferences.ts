export interface Preferences {
  sound: boolean;
  coachEnabled: boolean;
  speechRate: number;
  speechPitch: number;
}
type DeviceStorage = Pick<Storage, 'getItem' | 'setItem'>;
const legacyKey = 'life-abroad.preferences';
const soundKey = 'life-abroad.sound';
export const defaultPreferences: Preferences = { sound: true, coachEnabled: false, speechRate: 1, speechPitch: 1 };

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
    const saved: unknown = JSON.parse(storage?.getItem(legacyKey) ?? 'null');
    const savedSound: unknown = JSON.parse(storage?.getItem(soundKey) ?? 'null');
    if (typeof saved === 'object' && saved !== null) {
      state = {
        sound: typeof savedSound === 'boolean' ? savedSound
          : 'sound' in saved && typeof saved.sound === 'boolean' ? saved.sound : true,
        coachEnabled: 'coachEnabled' in saved && typeof saved.coachEnabled === 'boolean' ? saved.coachEnabled : false,
        speechRate: bounded('speechRate' in saved ? saved.speechRate : undefined, 'speechRate'),
        speechPitch: bounded('speechPitch' in saved ? saved.speechPitch : undefined, 'speechPitch'),
      };
    } else if (typeof savedSound === 'boolean') {
      state = { ...defaultPreferences, sound: savedSound };
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
      if (setting === 'sound') {
        try { storage?.setItem(soundKey, JSON.stringify(nextValue)); } catch { /* Retain the in-memory preference. */ }
      }
      listeners.forEach(listener => listener());
    },
  };
}
