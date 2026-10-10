import type { ConversationMessage, MessageSpeaker } from '../types/gameplay/dialogue';

export function appendMessage(history: ConversationMessage[], speaker: MessageSpeaker, text: string): ConversationMessage[] {
  return [...history, { id: (history.at(-1)?.id ?? 0) + 1, speaker, text }];
}
export function thinkingSpeaker(recording: boolean, pending: boolean): MessageSpeaker | null { return recording ? 'player' : pending ? 'npc' : null; }
