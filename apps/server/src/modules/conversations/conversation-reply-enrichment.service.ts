import { Injectable } from '@nestjs/common';
import {
  type ConversationMessage,
  type SendMessageRequest,
  type TurnMetadata,
} from '@life-abroad/shared';
import type { PoolClient } from 'pg';
import { AiService, type AiReplyResult } from '../ai/ai.service';
import { AiUsageService } from '../ai/ai-usage.service';
import { NpcPromptService } from '../ai/npc-prompt.service';
import { DialogueService, type DialogueContext } from '../dialogue/dialogue.service';
import { NpcMoodService } from '../npcs/npc-mood.service';
import { NpcRelationshipService } from '../npcs/npc-relationship.service';
import { classifySocialSignal } from '../npcs/social-signal';
import { evaluateFarewell } from './conversation-policy';
import { ConversationsRepository, type ConversationRow } from './conversations.repository';
import type { ConversationStream } from './conversation-reply.service';
import type { ScriptedConversationReply } from './conversation-scripted-reply.service';

interface EnrichReplyOptions {
  client: PoolClient;
  userId: string;
  conversationId: string;
  conversation: ConversationRow;
  context: DialogueContext;
  history: readonly ConversationMessage[];
  request: SendMessageRequest;
  scripted: ScriptedConversationReply;
  stream?: ConversationStream;
}

export interface EnrichedConversationReply extends ScriptedConversationReply {
  aiResult?: AiReplyResult;
}

@Injectable()
export class ConversationReplyEnrichmentService {
  constructor(
    private readonly conversations: ConversationsRepository,
    private readonly dialogue: DialogueService,
    private readonly ai: AiService,
    private readonly prompts: NpcPromptService,
    private readonly aiUsage: AiUsageService,
    private readonly relationships: NpcRelationshipService,
    private readonly moods: NpcMoodService,
  ) {}

  async enrich(options: EnrichReplyOptions): Promise<EnrichedConversationReply> {
    const {
      client,
      userId,
      conversationId,
      conversation,
      context,
      history,
      request,
      stream,
    } = options;
    const farewell = evaluateFarewell(history, request.text);
    let { metadata, responseText, nodeId } = options.scripted;
    let aiResult: AiReplyResult | undefined;

    // AI changes wording only; authoritative scripts run before this gate.
    if (
      this.ai.enabled &&
      metadata.misunderstood &&
      !farewell.currentIsGoodbye &&
      !farewell.response &&
      !conversation.pending_order &&
      !metadata.seller?.pendingOrder &&
      !metadata.seller?.closed &&
      !(await this.conversations.pendingQuest(
        client,
        userId,
        conversation.npc_id,
      ))
    ) {
      if (await this.aiUsage.limited(client, userId)) {
        const limit = await this.dialogue.node(context, 'global_ai_limit');
        responseText = limit.text;
        nodeId = limit.node.id;
        metadata = { ...metadata, intent: null, misunderstood: false };
      } else {
        const prompt = await this.prompts.build(
          client,
          userId,
          conversation.npc_id,
          conversationId,
          request.text,
        );
        aiResult = stream
          ? await this.ai.replyTrackedStream(
              context,
              prompt.text,
              prompt.prompt,
              stream.beforeSave,
              stream.signal,
            )
          : await this.ai.replyTracked(context, prompt.text, prompt.prompt);
        responseText = aiResult.text;
        metadata = {
          ...metadata,
          intent: null,
          ...(aiResult.usedProvider && !aiResult.fallback
            ? { ai: true as const }
            : {}),
        };
      }
    }

    if (!metadata.seller && farewell.response) {
      responseText = farewell.response.text;
      metadata = { ...metadata, farewellStage: farewell.response.stage };
    }

    metadata = await this.addSocialMetadata(
      client,
      userId,
      conversation.npc_id,
      request,
      metadata,
    );

    if (stream && (!aiResult || aiResult.fallback)) {
      if (stream.signal.aborted) {
        throw stream.signal.reason ?? new Error('Chat stream cancelled.');
      }
      await stream.beforeSave(responseText);
      if (stream.signal.aborted) {
        throw stream.signal.reason ?? new Error('Chat stream cancelled.');
      }
    }

    return {
      arrival: options.scripted.arrival,
      metadata,
      nodeId,
      responseText,
      ...(aiResult ? { aiResult } : {}),
    };
  }

  recordAiUsage(
    client: PoolClient,
    userId: string,
    conversationId: string,
    clientMessageId: string,
    result: AiReplyResult,
  ): Promise<void> {
    return this.aiUsage.record(
      client,
      userId,
      conversationId,
      clientMessageId,
      result,
    );
  }

  private async addSocialMetadata(
    client: PoolClient,
    userId: string,
    npcId: string,
    request: SendMessageRequest,
    metadata: TurnMetadata,
  ): Promise<TurnMetadata> {
    const socialSignal = classifySocialSignal(request.text, metadata.intent);
    const relationship = socialSignal
      ? await this.relationships.apply(
          client,
          userId,
          npcId,
          socialSignal,
          request.clientMessageId,
        )
      : await this.relationships.context(client, userId, npcId);
    const mood = await this.moods.resolve(client, userId, npcId);
    return {
      ...metadata,
      ...(socialSignal ? { relationship } : {}),
      effectiveMood: relationship.reactionMood ?? mood.id,
    };
  }
}
