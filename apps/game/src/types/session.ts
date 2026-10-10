import type { OnboardingOptions, PlayerResponse, PlayerState } from '@life-abroad/shared';
import type { OnboardingDraft } from './onboarding';
export interface StoredSession {
  token: string;
  refreshToken?: string;
  expiresAt?: number;
}
export interface SessionManagerOptions {
  refresh: (refreshToken: string) => Promise<StoredSession>;
  persist: (session: StoredSession) => Promise<void>;
  clear: () => Promise<void>;
  onChange: (session: StoredSession | null) => void;
  now?: () => number;
}
export interface SessionManager {
  set: (session: StoredSession | null) => Promise<void>;
  run: <T>(operation: (token: string) => Promise<T>) => Promise<T>;
  get: () => StoredSession | null;
  signOut: (revoke: (token: string) => Promise<void>) => Promise<void>;
}
export interface SessionValue {
  ready: boolean;
  token: string | null;
  player: PlayerResponse | PlayerState | null;
  draft: Partial<OnboardingDraft>;
  options: OnboardingOptions | null;
  playerError: string;
  playerLoading: boolean;
  refreshPlayer: () => Promise<PlayerResponse>;
  authenticate: (email: string, password: string, displayName?: string) => Promise<'signed-in' | 'confirmation-required'>;
  signOut: () => Promise<void>;
  refreshOptions: () => Promise<OnboardingOptions>;
  updateDraft: (changes: Partial<OnboardingDraft>) => void;
  startLife: () => Promise<PlayerState>;
}
