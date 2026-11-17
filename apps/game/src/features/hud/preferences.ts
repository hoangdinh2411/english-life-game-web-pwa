import type { UserMode } from '@life-abroad/shared';

export interface Preferences {
  sound: boolean;
  speechRate: number;
  speechPitch: number;
  userMode: UserMode;
}
type DeviceStorage = Pick<Storage, 'getItem' | 'setItem'>;
const legacyKey = 'life-abroad.preferences';
const soundKey = 'life-abroad.sound';
const userModeKey = 'life-abroad.user-mode';
export const defaultPreferences: Preferences = { sound: true, speechRate: 1, speechPitch: 1, userMode: 'adult' };

const bounds = {
  speechRate: { min: 0.75, max: 1.5 },
  speechPitch: { min: 0.75, max: 1.25 },
} as const;

function bounded(value: unknown, setting: keyof typeof bounds): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return defaultPreferences[setting];
  return Math.min(bounds[setting].max, Math.max(bounds[setting].min, value));
}

function parseUserMode(value: unknown): UserMode {
  return value === 'kid' ? 'kid' : 'adult';
}

export function createPreferences(storage?: DeviceStorage) {
  let state = defaultPreferences;
  try {
    const saved: unknown = JSON.parse(storage?.getItem(legacyKey) ?? 'null');
    const savedSound: unknown = JSON.parse(storage?.getItem(soundKey) ?? 'null');
    const savedMode: unknown = JSON.parse(storage?.getItem(userModeKey) ?? 'null');
    const mode = savedMode ? parseUserMode(savedMode)
      : typeof saved === 'object' && saved !== null && 'userMode' in saved
        ? parseUserMode((saved as Record<string, unknown>).userMode)
        : 'adult';

    if (typeof saved === 'object' && saved !== null) {
      state = {
        sound: typeof savedSound === 'boolean' ? savedSound
          : 'sound' in saved && typeof saved.sound === 'boolean' ? saved.sound : true,
        speechRate: bounded('speechRate' in saved ? saved.speechRate : undefined, 'speechRate'),
        speechPitch: bounded('speechPitch' in saved ? saved.speechPitch : undefined, 'speechPitch'),
        userMode: mode,
      };
    } else if (typeof savedSound === 'boolean' || savedMode) {
      state = {
        ...defaultPreferences,
        sound: typeof savedSound === 'boolean' ? savedSound : true,
        userMode: mode,
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
        : setting === 'userMode'
          ? parseUserMode(value)
          : value;
      state = { ...state, [setting]: nextValue };
      if (setting === 'sound') {
        try { storage?.setItem(soundKey, JSON.stringify(nextValue)); } catch { /* Retain the in-memory preference. */ }
      }
      if (setting === 'userMode') {
        try { storage?.setItem(userModeKey, JSON.stringify(nextValue)); } catch { /* Retain the in-memory preference. */ }
      }
      listeners.forEach(listener => listener());
    },
  };
}
