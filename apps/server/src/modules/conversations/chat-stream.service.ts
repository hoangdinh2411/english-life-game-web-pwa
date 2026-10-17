import { ConflictException, Injectable } from '@nestjs/common';
import type { ChatStreamRequest, ConversationTurn } from '@life-abroad/shared';
import { ConversationsService } from './conversations.service';

export type ChatEvent =
  | { event: 'token'; data: { text: string } }
  | { event: 'done'; data: { turn: ConversationTurn } };

@Injectable()
export class ChatStreamService {
  private readonly activeUsers = new Set<string>();

  constructor(private readonly conversations: ConversationsService) {}

  async stream(userId: string, request: ChatStreamRequest,
    emit: (event: ChatEvent) => void, signal: AbortSignal): Promise<void> {
    if (this.activeUsers.has(userId)) throw new ConflictException('Finish the current chat reply first.');
    this.activeUsers.add(userId);
    try {
      const turn = await this.conversations.sendStreaming(userId, request.conversationId, request.npcId, {
        clientMessageId: request.clientMessageId, text: request.text, coach: request.coach,
      }, async text => {
        if (signal.aborted) throw signal.reason ?? new Error('Chat stream cancelled.');
        emit({ event: 'token', data: { text } });
      }, signal);
      if (signal.aborted) throw signal.reason ?? new Error('Chat stream cancelled.');
      emit({ event: 'done', data: { turn } });
    } finally {
      this.activeUsers.delete(userId);
    }
  }
}
