import type { CreateCharacterRequest, IdCardIssueResponse, IssueIdCardBody, MovementTutorialPageId, NpcPresenceResponse, OnboardingOptions, PlayerLocation, PlayerPreferences, PlayerPreferencesInitialize, PlayerPreferencesRead, PlayerPreferencesUpdate, PlayerResponse, PlayerState, TutorialSpeechResponse } from '@life-abroad/shared';
import { parseOnboardingOptions, arrivalStateSchema, conversationHistoryPageSchema, conversationSchema, conversationTurnSchema, idCardIssueResponseSchema, npcPresenceResponseSchema, playerPreferencesReadSchema, playerPreferencesSchema, tutorialSpeechResponseSchema, ARRIVAL_NPC_ID, type Conversation, type ConversationHistoryPage, type SendMessageRequest } from '@life-abroad/shared';

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
export const savePlayerLocation = (token: string, location: PlayerLocation): Promise<PlayerLocation> =>
  request('players/location', location, token);
export const loadNpcPresence = async (token: string, mapId: string): Promise<NpcPresenceResponse> =>
  npcPresenceResponseSchema.parse(await request(`npcs/presence?${new URLSearchParams({ mapId })}`, undefined, token));
export const loadPlayerPreferences = async (token: string): Promise<PlayerPreferencesRead> =>
  playerPreferencesReadSchema.parse(await request('players/preferences', undefined, token));
export const initializePlayerPreferences = async (token: string, body: PlayerPreferencesInitialize): Promise<PlayerPreferences> =>
  playerPreferencesSchema.parse(await request('players/preferences/initialize', body, token));
export const updatePlayerPreferences = async (token: string, body: PlayerPreferencesUpdate): Promise<PlayerPreferences> =>
  playerPreferencesSchema.parse(await request('players/preferences', body, token));
export const loadTutorialSpeech = async (token: string, pageId: MovementTutorialPageId): Promise<TutorialSpeechResponse> =>
  tutorialSpeechResponseSchema.parse(await request(`tutorial/speech/${encodeURIComponent(pageId)}`, undefined, token));

export const loadArrival = async (token: string) => arrivalStateSchema.parse(await request('quests/arrival', undefined, token));
export const enterTownStreet = async (token: string) => arrivalStateSchema.parse(await request('quests/arrival/enter-town-street', {}, token));
export async function openConversation(token: string, npcId: Conversation['npcId']): Promise<Conversation> {
  const history = conversationHistoryPageSchema.parse(await request(
    `conversations/history/${encodeURIComponent(npcId)}`, undefined, token));
  const created = conversationSchema.parse(await request('conversations', { npcId }, token));
  return conversationSchema.parse({ ...created,
    messages: [...history.messages, ...created.messages],
    historyCursor: { npcId, beforeMessageId: history.beforeMessageId, hasMore: history.hasMore },
  });
}
export async function loadOlderConversationMessages(token: string, npcId: Conversation['npcId'], before: string): Promise<ConversationHistoryPage> {
  const query = new URLSearchParams({ before });
  return conversationHistoryPageSchema.parse(await request(`conversations/history/${encodeURIComponent(npcId)}?${query}`, undefined, token));
}
export const startArrivalConversation = (token: string) => openConversation(token, ARRIVAL_NPC_ID);
export const sendArrivalMessage = async (token: string, id: string, body: SendMessageRequest) =>
  conversationTurnSchema.parse(await request(`conversations/${encodeURIComponent(id)}/messages`, body, token));

export async function issueIdCard(token: string, body: IssueIdCardBody, photo: Blob | null): Promise<IdCardIssueResponse> {
  if (!navigator.onLine) throw new Error('Reconnect to issue your ID card. Nothing was queued.');
  const form = new FormData();
  form.set('conversationId', body.conversationId);
  form.set('idempotencyKey', body.idempotencyKey);
  if (photo) form.set('photo', photo, 'id-photo.jpg');
  const response = await fetch(`${baseUrl}/me/id-card`, { method: 'POST',
    headers: { Authorization: `Bearer ${token}` }, body: form, cache: 'no-store', signal: AbortSignal.timeout(30000) });
  if (!response.ok) {
    const result: unknown = await response.json().catch(() => null);
    const message = typeof result === 'object' && result !== null && 'error' in result && typeof result.error === 'object' && result.error !== null && 'message' in result.error
      ? String(result.error.message) : `Request failed (${response.status})`;
    const error = new Error(message); Object.assign(error, { status: response.status }); throw error;
  }
  return idCardIssueResponseSchema.parse(await response.json());
}

