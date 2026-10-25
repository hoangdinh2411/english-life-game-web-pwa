import { Injectable } from '@nestjs/common';
import {
  type ArrivalState,
  type ConversationMessage,
  type SendMessageRequest,
  type TurnMetadata,
} from '@life-abroad/shared';
import type { PoolClient } from 'pg';
import type { AiReplyResult } from '../ai/ai.service';
import type { DialogueContext } from '../dialogue/dialogue.service';
import { ConversationReplyEnrichmentService } from './conversation-reply-enrichment.service';
import type { ConversationRow } from './conversations.repository';
import { ConversationScriptedReplyService } from './conversation-scripted-reply.service';

export interface ConversationStream {
  npcId: string;
  beforeSave: (text: string) => Promise<void>;
  signal: AbortSignal;
}

interface ResolveReplyOptions {
  client: PoolClient;
  userId: string;
  conversationId: string;
  conversation: ConversationRow;
  context: DialogueContext;
  history: readonly ConversationMessage[];
  request: SendMessageRequest;
  arrival: ArrivalState;
  stream?: ConversationStream;
}

export interface ResolvedConversationReply {
  arrival: ArrivalState;
  metadata: TurnMetadata;
  nodeId: string;
  responseText: string;
  aiResult?: AiReplyResult;
}

@Injectable()
export class ConversationReplyService {
  constructor(
    private readonly scriptedReplies: ConversationScriptedReplyService,
    private readonly enrichment: ConversationReplyEnrichmentService,
  ) {}

  async resolve(options: ResolveReplyOptions): Promise<ResolvedConversationReply> {
    const scripted = await this.scriptedReplies.resolve({
      client: options.client,
      userId: options.userId,
      conversation: options.conversation,
      context: options.context,
      request: options.request,
      arrival: options.arrival,
    });
    return this.enrichment.enrich({
      client: options.client,
      userId: options.userId,
      conversationId: options.conversationId,
      conversation: options.conversation,
      context: options.context,
      history: options.history,
      request: options.request,
      scripted,
      ...(options.stream ? { stream: options.stream } : {}),
    });
  }

  recordAiUsage(
    client: PoolClient,
    userId: string,
    conversationId: string,
    clientMessageId: string,
    result: AiReplyResult,
  ): Promise<void> {
    return this.enrichment.recordAiUsage(
      client,
      userId,
      conversationId,
      clientMessageId,
      result,
    );
  }
}
