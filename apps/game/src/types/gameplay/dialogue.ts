export type MessageSpeaker = 'player' | 'npc';
export interface ConversationMessage {
  id: number;
  speaker: MessageSpeaker;
  text: string;
}
export interface AiFallbackContext {
  npcId: string;
  step: number;
}
export type AiFallbackLogger = (message: string, metadata: AiFallbackContext & {
  reason: string;
}) => void;
