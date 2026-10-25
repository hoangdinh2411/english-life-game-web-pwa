
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import type { OnboardingOptions, PlayerResponse, PlayerState } from '@life-abroad/shared';
import * as api from '../api/client';
import { login, logout, refreshSession, register } from '../api/supabase-auth';
import { mergeOnboardingDraft } from '../onboarding/onboarding-state';
import type { OnboardingDraft } from '../types/onboarding';
import type { SessionValue } from '../types/session';
import { clearSessionToken, readStoredSession, writeStoredSession } from './storage';
import { createSessionManager } from './session-manager';
import { disablePreferenceSynchronization, synchronizePreferences } from '../features/hud/usePreferences';

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [player, setPlayer] = useState<PlayerResponse | PlayerState | null>(null);
  const [draft, setDraft] = useState<Partial<OnboardingDraft>>({});
  const [options, setOptions] = useState<OnboardingOptions | null>(null);
  const [playerError, setPlayerError] = useState('');
  const [playerLoading, setPlayerLoading] = useState(false);
  const manager = useMemo(() => createSessionManager({ refresh: refreshSession, persist: writeStoredSession,
    clear: clearSessionToken, onChange: (session) => setToken(session?.token ?? null) }), []);

  useEffect(() => {
    if (token) synchronizePreferences(manager.run);
    else disablePreferenceSynchronization();
  }, [manager, token]);

  const refreshPlayer = useCallback(async (background = false) => {
    if (!background) { setPlayerError(''); setPlayerLoading(true); }
    try {
      const result = await manager.run(api.loadPlayer);
      setPlayer(result);
      return result;
    } catch (error) {
      if (!background) setPlayerError('Check your connection, then try again. Your saved game has not changed.');
      throw error;
    } finally { if (!background) setPlayerLoading(false); }
  }, [manager]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const stored = await readStoredSession();
        if (!stored || !mounted) return;
        await manager.set(stored);
        if (!navigator.onLine) { if (mounted) setPlayerError('Reconnect to load your saved game. Local practice is available offline.'); return; }
        const result = await manager.run(api.loadPlayer);
        if (mounted) setPlayer(result);
      } catch (error) {
        if (typeof error === 'object' && error !== null && 'status' in error && error.status === 401) await manager.set(null);
        else if (mounted) setPlayerError('Check your connection, then try again. Your saved game has not changed.');
      } finally { if (mounted) setReady(true); }
    })();
    return () => { mounted = false; };
  }, [manager]);

  const authenticate = useCallback(async (email: string, password: string, displayName?: string) => {
    const result = displayName === undefined ? await login(email, password) : await register(email, password, displayName);
    if ('requiresEmailConfirmation' in result) return 'confirmation-required';
    await manager.set(result);
    await refreshPlayer();
    return 'signed-in';
  }, [refreshPlayer, manager]);

  const signOut = useCallback(async () => {
    setPlayer(null); setDraft({}); setOptions(null); setPlayerError('');
    // Clear locally before network revocation, including offline sign out.
    await manager.signOut(logout).catch(() => undefined);
  }, [manager]);

  const refreshOptions = useCallback(async () => {
    const result = await manager.run(api.loadOptions);
    setOptions(result);
    return result;
  }, [manager]);

  const startLife = useCallback(async (submission?: OnboardingDraft) => {
    if (!token) throw new Error('Please sign in again.');
    const character = submission ?? draft;
    if (!character.name || !character.countryId || !character.gender) throw new Error('Complete all three setup steps.');
    try {
      const request = { name: character.name, countryId: character.countryId, gender: character.gender };
      const result = await manager.run((sessionToken) => api.createCharacter(sessionToken, request));
      setPlayer(result);
      return result;
    } catch (creationError) {
      const current = await manager.run(api.loadPlayer).catch(() => null);
      if (current?.character && current.stats) {
        setPlayer(current);
        return { user: current.user, character: current.character, stats: current.stats, inventory: [], questProgress: [] };
      }
      throw creationError;
    }
  }, [draft, token, manager]);

  const value = useMemo<SessionValue>(() => ({
    ready, token, player, draft, options, playerError, playerLoading, refreshPlayer, runAuthenticated: manager.run,
    authenticate, signOut, refreshOptions,
    updateDraft: (changes) => setDraft((current) => mergeOnboardingDraft(current, changes)),
    startLife,
  }), [ready, token, player, draft, options, playerError, playerLoading, refreshPlayer, authenticate, signOut, refreshOptions, startLife]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const session = useContext(SessionContext);
  if (!session) throw new Error('SessionProvider is required');
  return session;
}
