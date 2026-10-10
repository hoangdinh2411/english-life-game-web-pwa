import type { SessionManager, SessionManagerOptions, StoredSession } from '../types/session';

function errorStatus(error: unknown): number | undefined {
  return typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number' ? error.status : undefined;
}

export function createSessionManager({ refresh, persist, clear, onChange, now = () => Date.now() }: SessionManagerOptions): SessionManager {
  let session: StoredSession | null = null;
  let pendingRefresh: Promise<StoredSession | null> | null = null;
  let revision = 0;
  let writes = Promise.resolve();

  function enqueue(operation: () => Promise<void>): Promise<void> {
    writes = writes.then(operation, operation);
    return writes;
  }

  async function set(next: StoredSession | null): Promise<void> {
    const currentRevision = ++revision;
    session = next;
    await enqueue(() => next ? persist(next) : clear());
    if (revision === currentRevision) onChange(next);
  }

  async function refreshCurrent(): Promise<StoredSession | null> {
    if (!session?.refreshToken) return session;
    if (pendingRefresh) return pendingRefresh;
    const refreshToken = session.refreshToken;
    const currentRevision = revision;
    const request = (async () => {
      let next;
      try { next = await refresh(refreshToken); }
      catch (error) {
        if (revision === currentRevision && [400, 401, 403, 422].includes(errorStatus(error) ?? 0)) await set(null);
        throw error;
      }
      // An in-flight refresh must never restore a session after logout/new login.
      if (revision !== currentRevision) return session;
      await set(next);
      return next;
    })();
    pendingRefresh = request;
    try { return await request; }
    finally { if (pendingRefresh === request) pendingRefresh = null; }
  }

  async function run<T>(operation: (token: string) => Promise<T>): Promise<T> {
    let current = session;
    if (current?.refreshToken && current.expiresAt !== undefined && current.expiresAt * 1000 <= now() + 60000) current = await refreshCurrent();
    if (!current) throw new Error('Please sign in again.');
    try { return await operation(current.token); }
    catch (error) {
      if (errorStatus(error) !== 401 || !session?.refreshToken) throw error;
      const next = session.token !== current.token ? session : await refreshCurrent();
      if (!next) throw new Error('Please sign in again.');
      return operation(next.token);
    }
  }

  async function signOut(revoke: (token: string) => Promise<void>): Promise<void> {
    const previous = session;
    await set(null);
    if (previous) await revoke(previous.token);
  }

  return { set, run, signOut, get: () => session };
}
