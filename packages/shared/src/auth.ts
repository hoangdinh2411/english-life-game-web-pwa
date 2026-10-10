import { z } from 'zod';

export interface AuthUser { id: string; email: string; displayName: string }
export interface Credentials { email: string; password: string; displayName?: string }
export interface AuthSession {
  token: string;
  user: AuthUser;
  refreshToken?: string;
  expiresAt?: number;
}
export interface EmailConfirmationRequired { requiresEmailConfirmation: true }
export type RegistrationResponse = AuthSession | EmailConfirmationRequired;

export function parseCredentials(value: unknown): Credentials {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Invalid credentials');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !['email', 'password', 'displayName'].includes(key)) || typeof input.email !== 'string' || typeof input.password !== 'string') throw new Error('Invalid credentials');
  const email = input.email.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || input.password.length < 8 || input.password.length > 128) throw new Error('Email or password is invalid');
  if (input.displayName === undefined) return { email, password: input.password };
  if (typeof input.displayName !== 'string' || input.displayName.trim().length === 0 || input.displayName.length > 2000) throw new Error('Display name is invalid');
  return { email, password: input.password, displayName: input.displayName };
}

// Adapt existing parsers to Zod without changing their validation rules/messages.
export function schemaFromParser<T>(parse: (value: unknown) => T) {
  return z.unknown().transform((value, context) => {
    try { return parse(value); }
    catch (error) {
      context.addIssue({ code: 'custom', message: error instanceof Error ? error.message : 'Invalid request' });
      return z.NEVER;
    }
  });
}

export const credentialsSchema = schemaFromParser(parseCredentials);
export const registrationSchema = schemaFromParser((value): Credentials & { displayName: string } => {
  const input = parseCredentials(value);
  if (!input.displayName) throw new Error('Display name is required');
  return { ...input, displayName: input.displayName };
});
export const refreshSessionSchema = z.object({ refreshToken: z.string().min(1).max(4096) }).strict();
