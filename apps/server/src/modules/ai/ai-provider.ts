export const AI_PROVIDER = Symbol('AI_PROVIDER');

export interface AiReplyRequest {
  readonly npcId: string;
  readonly text: string;
}

// Providers produce dialogue only; they cannot return gameplay commands or grants.
export interface AiProvider {
  reply(request: AiReplyRequest, signal: AbortSignal): Promise<string>;
}
