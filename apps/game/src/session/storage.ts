
import type { StoredSession } from '../types/session';
const SESSION_KEY = 'life_abroad_session';
export async function readStoredSession(): Promise<StoredSession | null> {
  // Promote the previous tab-only session once; never store a player profile.
  const raw = localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { await clearSessionToken(); return null; }
  if (typeof parsed !== 'object' || parsed === null || !('token' in parsed) || typeof parsed.token !== 'string' || !parsed.token) {
    await clearSessionToken(); return null;
  }
  const refreshToken = 'refreshToken' in parsed && typeof parsed.refreshToken === 'string' ? parsed.refreshToken : undefined;
  const expiresAt = 'expiresAt' in parsed && typeof parsed.expiresAt === 'number' && Number.isFinite(parsed.expiresAt) ? parsed.expiresAt : undefined;
  const session = { token: parsed.token, ...(refreshToken === undefined ? {} : { refreshToken }), ...(expiresAt === undefined ? {} : { expiresAt }) };
  await writeStoredSession(session);
  return session;
}
export async function writeStoredSession(session: StoredSession): Promise<void> {
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    token: session.token,
    ...(session.refreshToken === undefined ? {} : { refreshToken: session.refreshToken }),
    ...(session.expiresAt === undefined ? {} : { expiresAt: session.expiresAt }),
  }));
  sessionStorage.removeItem(SESSION_KEY);
}
export async function clearSessionToken(): Promise<void> {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}
