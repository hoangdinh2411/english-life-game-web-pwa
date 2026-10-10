import { createClient, type Session } from "@supabase/supabase-js";
import {
  parseCredentials,
  registrationSchema,
  type AuthSession,
  type RegistrationResponse,
} from "@life-abroad/shared";

function authClient() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new Error("Supabase authentication is not configured.");
  // The session manager owns tokens-only storage and refresh. Each SDK operation
  // is isolated so an in-flight refresh cannot retain credentials after logout.
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store', signal: init?.signal ?? AbortSignal.timeout(15000) }) },
  }).auth;
}

function mapSession(session: Session | null): AuthSession {
  if (!session) throw new Error("Please sign in again.");
  const name: unknown = session.user.user_metadata.display_name;
  return {
    token: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt:
      session.expires_at ?? Math.floor(Date.now() / 1000) + session.expires_in,
    user: {
      id: session.user.id,
      email: session.user.email ?? "",
      displayName: typeof name === "string" ? name : "",
    },
  };
}

export async function register(
  email: string,
  password: string,
  displayName: string,
): Promise<RegistrationResponse> {
  const input = registrationSchema.parse({ email, password, displayName });
  const { data, error } = await authClient().signUp({
    email: input.email,
    password: input.password,
    options: { data: { display_name: input.displayName } },
  });
  if (error) throw error;
  return data.session
    ? mapSession(data.session)
    : { requiresEmailConfirmation: true };
}

export async function login(
  email: string,
  password: string,
): Promise<AuthSession> {
  const input = parseCredentials({ email, password });
  const { data, error } = await authClient().signInWithPassword(input);
  if (error) throw error;
  return mapSession(data.session);
}

export async function refreshSession(
  refreshToken: string,
): Promise<AuthSession> {
  const { data, error } = await authClient().refreshSession({
    refresh_token: refreshToken,
  });
  if (error) throw error;
  return mapSession(data.session);
}

export async function logout(token: string): Promise<void> {
  // This SDK method revokes the current session using its bearer token and the
  // public project key; no service-role key or server auth endpoint is involved.
  const { error } = await authClient().admin.signOut(token, "local");
  if (error) throw error;
}
