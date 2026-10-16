import type { CreateCharacterRequest, OnboardingOptions, PlayerResponse, PlayerState } from '@life-abroad/shared';
import { parseOnboardingOptions, arrivalStateSchema, conversationSchema, conversationTurnSchema, ARRIVAL_NPC_ID, type Conversation, type SendMessageRequest } from '@life-abroad/shared';

const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export async function request<T>(path: string, body?: unknown, token?: string): Promise<T> {
  if (!navigator.onLine) throw new Error('Connect to the internet to use saved game features. Local practice is available offline.');
  const response = await fetch(`${baseUrl}/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const result: unknown = await response.json().catch(() => null);
    const message = typeof result === 'object' && result !== null && 'error' in result && typeof result.error === 'object' && result.error !== null && 'message' in result.error
      ? String(result.error.message) : `Request failed (${response.status})`;
    const error = new Error(message);
    Object.assign(error, { status: response.status });
    throw error;
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export const loadOptions = async (token: string): Promise<OnboardingOptions> =>
  parseOnboardingOptions(await request<unknown>('onboarding/options', undefined, token));
export const loadPlayer = (token: string): Promise<PlayerResponse> => request('me', undefined, token);
export const createCharacter = (token: string, body: CreateCharacterRequest) => request<PlayerState>('characters', body, token);

export const loadArrival = async (token: string) => arrivalStateSchema.parse(await request('quests/arrival', undefined, token));
export const enterTownStreet = async (token: string) => arrivalStateSchema.parse(await request('quests/arrival/enter-town-street', {}, token));
const conversationKey = (npcId: string): string => `life-abroad.conversation.${npcId}`;
export async function openConversation(token: string, npcId: Conversation['npcId']): Promise<Conversation> {
  let savedId: string | null = null;
  try { savedId = sessionStorage.getItem(conversationKey(npcId)); } catch { /* storage is optional */ }
  if (savedId) {
    try {
      const saved = conversationSchema.parse(await request(`conversations/${encodeURIComponent(savedId)}`, undefined, token));
      if (saved.npcId === npcId && !saved.seller?.closed) return saved;
    } catch (error) {
      const status = typeof error === 'object' && error !== null && 'status' in error ? error.status : null;
      if (status !== 404) throw error;
    }
  }
  const conversation = conversationSchema.parse(await request('conversations', { npcId }, token));
  try { sessionStorage.setItem(conversationKey(npcId), conversation.id); } catch { /* continue in memory */ }
  return conversation;
}
export const startArrivalConversation = (token: string) => openConversation(token, ARRIVAL_NPC_ID);
export const sendArrivalMessage = async (token: string, id: string, body: SendMessageRequest) =>
  conversationTurnSchema.parse(await request(`conversations/${encodeURIComponent(id)}/messages`, body, token));

