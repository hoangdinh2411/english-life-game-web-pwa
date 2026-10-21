import { Injectable } from '@nestjs/common';
import type { Conversation, ConversationHistoryPage, ConversationMessage, ConversationTurn, MoodId } from '@life-abroad/shared';
import { AiSpeechService } from './ai-speech.service';
import { FixedSpeechService } from './fixed-speech.service';
import { SpeechProfileService } from './speech-profile.service';

const SPEECH_REPLY_TIMEOUT_MS = 9_000;

export async function withinSpeechReplyBudget<T>(work: Promise<T>, timeoutMs = SPEECH_REPLY_TIMEOUT_MS): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new Error('Speech generation timed out.')), timeoutMs);
  });
  try { return await Promise.race([work, deadline]); }
  finally { if (timeout) clearTimeout(timeout); }
}

@Injectable()
export class ConversationSpeechService {
  constructor(private readonly fixed: FixedSpeechService, private readonly ai: AiSpeechService,
    private readonly profiles: SpeechProfileService) {}

  async message(userId: string, npcId: Conversation['npcId'], message: ConversationMessage,
    mood: MoodId = 'neutral'): Promise<ConversationMessage> {
    if (message.sender !== 'npc') return message;
    try {
      const identity = await this.profiles.identity(npcId, mood);
      const generated = await withinSpeechReplyBudget(message.ai
        ? this.ai.get(userId, message.id, identity)
        : this.fixed.get({ ...identity, text: message.text }));
      return { ...message, speech: { url: generated.url } };
    } catch { return message; }
  }

  async conversation(userId: string, conversation: Conversation): Promise<Conversation> {
    return { ...conversation, messages: await Promise.all(conversation.messages.map(
      message => this.message(userId, conversation.npcId, message))) };
  }
  async history(userId: string, npcId: Conversation['npcId'], page: ConversationHistoryPage): Promise<ConversationHistoryPage> {
    return { ...page, messages: await Promise.all(page.messages.map(message => this.message(userId, npcId, message))) };
  }
  async turn(userId: string, npcId: Conversation['npcId'], turn: ConversationTurn): Promise<ConversationTurn> {
    return { ...turn, npcMessage: await this.message(userId, npcId, turn.npcMessage, turn.effectiveMood) };
  }
}
