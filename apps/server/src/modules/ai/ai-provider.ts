export const AI_PROVIDER = Symbol('AI_PROVIDER');

export interface AiReplyRequest {
  readonly npcId: string;
  readonly text: string;
  readonly prompt?: AiPrompt;
}

export interface AiPrompt {
  readonly system: string;
  readonly history: ReadonlyArray<{ speaker: 'player' | 'npc'; text: string }>;
}

// Providers produce dialogue only; they cannot return gameplay commands or grants.
export interface AiProvider {
  reply(request: AiReplyRequest, signal: AbortSignal): Promise<string>;
  stream?(request: AiReplyRequest, signal: AbortSignal): AsyncIterable<string>;
}
