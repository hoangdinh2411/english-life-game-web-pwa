import { LifeService } from '../life/life.service';
import { ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ARRIVAL_NPC_ID, CAFE_SELLER_NPC_IDS, SELLER_NPC_ID, SHOP_NPC_IDS, TOWN_STREET_NPC_IDS, Conversation, ConversationMessage, ConversationTurn, SendMessageRequest, STATION_LOCATION_ID, TurnMetadata, venueHoursLabel, detectIntent, farewellClosing, isDirectQuestion } from '@life-abroad/shared';
import { DialogueService } from '../dialogue/dialogue.service';
import { QuestsService } from '../quests/quests.service';
import { ConversationsRepository, sellerState } from './conversations.repository';
import { SellerService } from './seller.service';
import { conversationNpcSchema } from '@life-abroad/shared';
import { CoffeeQuestService } from '../quests/coffee-quest.service';
import { AiService } from '../ai/ai.service';
import { NpcPromptService } from '../ai/npc-prompt.service';
import { AiUsageService } from '../ai/ai-usage.service';
import type { AiReplyResult } from '../ai/ai.service';
import type { ConversationHistoryPage } from '@life-abroad/shared';
import { ConversationSpeechService } from '../speech/conversation-speech.service';
import { NpcPresenceService } from '../npcs/npc-presence.service';
import { NpcRelationshipService } from '../npcs/npc-relationship.service';
import { classifySocialSignal } from '../npcs/social-signal';
import { NpcMoodService } from '../npcs/npc-mood.service';

const isCafeSeller = (npcId: string): boolean => (CAFE_SELLER_NPC_IDS as readonly string[]).includes(npcId);

function openingMessageId(conversationId: string): string {
  const bytes = createHash('sha256').update(`opening-message:${conversationId}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function transientOpening(conversationId: string, text: string): ConversationMessage {
  return { id: openingMessageId(conversationId), sender: 'npc', text, createdAt: new Date().toISOString() };
}

@Injectable()
export class ConversationsService {
  constructor(private readonly conversations: ConversationsRepository,
    private readonly dialogue: DialogueService, private readonly quests: QuestsService, private readonly life: LifeService,
    private readonly seller: SellerService, private readonly coffee: CoffeeQuestService,
    private readonly ai: AiService, private readonly prompts: NpcPromptService,
    private readonly aiUsage: AiUsageService, private readonly speech: ConversationSpeechService,
    private readonly presence: NpcPresenceService, private readonly relationships: NpcRelationshipService,
    private readonly moods: NpcMoodService) {}

  async create(userId: string, npcId: string = ARRIVAL_NPC_ID): Promise<Conversation> {
    const conversation = await this.conversations.transaction(async client => {
      await this.presence.assertCanStart(client, userId, npcId);
      const arrival = await this.quests.getArrival(userId, client);
      if (isCafeSeller(npcId) || npcId === 'npc_clothes_seller') {
        const openingVariation = await this.conversations.variationIndex(client, userId, npcId, true);
        const baseContext = await this.conversations.context(client, userId, npcId);
        const id = await this.conversations.create(client, userId, npcId, openingVariation);
        const context = { ...baseContext, variationIndex: openingVariation };
        const greeting = transientOpening(id, await this.seller.opening(context));
        const seller = { shop: npcId === 'npc_clothes_seller' ? 'clothes' as const : 'cafe' as const,
          pendingOrder: null, closed: false };
        return { id, npcId: conversationNpcSchema.parse(npcId), messages: [greeting], arrival, seller,
          ...(npcId === SELLER_NPC_ID ? { coffeeQuest: await this.coffee.get(userId, client) } : {}) };
      }
      if (npcId !== ARRIVAL_NPC_ID) {
        const openingVariation = await this.conversations.variationIndex(client, userId, npcId, true);
        const baseContext = await this.conversations.context(client, userId, npcId);
        const openingNode = (TOWN_STREET_NPC_IDS as readonly string[]).includes(npcId) ? 'townsperson_start' : 'shop_start';
        const id = await this.conversations.create(client, userId, npcId, openingVariation);
        const context = { ...baseContext, variationIndex: openingVariation };
        const opening = await this.dialogue.node(context, openingNode);
        const greeting = transientOpening(id, opening.text);
        return { id, npcId: conversationNpcSchema.parse(npcId), messages: [greeting], arrival,
          ...(npcId === 'npc_cafe_waiter' ? { coffeeQuest: await this.coffee.get(userId, client) } : {}) };
      }
      if (arrival.locationId !== STATION_LOCATION_ID) throw new ConflictException('Visit the station receptionist first');
      const openingVariation = await this.conversations.variationIndex(client, userId, npcId, true);
      const baseContext = await this.conversations.context(client, userId);
      const id = await this.conversations.create(client, userId, npcId, openingVariation);
      const context = { ...baseContext, variationIndex: openingVariation };
      const opening = await this.dialogue.node(context, 'receptionist_start');
      const greeting = transientOpening(id, opening.text);
      return { id, npcId: ARRIVAL_NPC_ID, messages: [greeting], arrival };
    });
    return this.speech.conversation(userId, { ...conversation, npcId: conversationNpcSchema.parse(conversation.npcId) });
  }

  async get(userId: string, id: string): Promise<Conversation> {
    const conversation = await this.conversations.transaction(async client => {
      const arrival = await this.quests.getArrival(userId, client);
      const row = await this.conversations.load(client, userId, id);
      return { id, npcId: conversationNpcSchema.parse(row.npc_id),
        arrival, messages: await this.conversations.messages(client, id),
        ...(isCafeSeller(row.npc_id) || row.npc_id === 'npc_clothes_seller' ? { seller: sellerState(row) } : {}),
        ...([SELLER_NPC_ID,'npc_cafe_waiter'].includes(row.npc_id) ? { coffeeQuest: await this.coffee.get(userId, client) } : {}) };
    });
    return this.speech.conversation(userId, conversation);
  }

  async historyPage(userId: string, npcId: string, before?: string): Promise<ConversationHistoryPage> {
    const page = await this.conversations.transaction(async client => {
      return this.conversations.olderMessages(client, userId, conversationNpcSchema.parse(npcId), before);
    });
    return this.speech.history(userId, conversationNpcSchema.parse(npcId), page);
  }

  send(userId: string, id: string, request: SendMessageRequest): Promise<ConversationTurn> {
    return this.sendInternal(userId, id, request);
  }

  sendStreaming(userId: string, id: string, npcId: string, request: SendMessageRequest,
    beforeSave: (text: string) => Promise<void>, signal: AbortSignal): Promise<ConversationTurn> {
    return this.sendInternal(userId, id, request, { npcId, beforeSave, signal });
  }

  private async sendInternal(userId: string, id: string, request: SendMessageRequest,
    stream?: { npcId: string; beforeSave: (text: string) => Promise<void>; signal: AbortSignal }): Promise<ConversationTurn> {
    const result = await this.conversations.transaction(async client => {
      // Always lock the character before the conversation, matching quest lock order.
      let arrival = await this.quests.getArrival(userId, client);
      const conversation = await this.conversations.load(client, userId, id);
      if (stream && conversation.npc_id !== stream.npcId) throw new ConflictException('Conversation NPC does not match');
      const replay = await this.conversations.replay(client, id, request);
      if (replay) {
        if (stream) await stream.beforeSave(replay.npcMessage.text);
        return { npcId: conversationNpcSchema.parse(conversation.npc_id), turn: { ...replay, arrival,
        ...(isCafeSeller(conversation.npc_id) || conversation.npc_id === 'npc_clothes_seller'
          ? { seller: sellerState(conversation) } : {}),
        ...([SELLER_NPC_ID, 'npc_cafe_waiter'].includes(conversation.npc_id)
          ? { coffeeQuest: await this.coffee.get(userId, client) } : {}) } };
      }
      const receptionist = conversation.npc_id === ARRIVAL_NPC_ID;
      if (conversation.ended_at) throw new ConflictException('This conversation has ended. Start a new conversation');
      if (receptionist && arrival.locationId !== STATION_LOCATION_ID) throw new ConflictException('Visit the station receptionist first');
      await this.life.consumeMessage(client, userId);
      const context = { ...await this.conversations.context(client, userId, conversation.npc_id),
        variationIndex: await this.conversations.variationIndex(client, userId, conversation.npc_id),
        ...(conversation.current_node_id ? { currentNodeId: conversation.current_node_id } : {}) };
      const history = await this.conversations.messages(client, id);
      let priorGoodbyes = 0;
      let lastGoodbyeIndex = -1;
      let priorNpcIndex = -1;
      let priorNpcMessage: typeof history[number] | undefined;
      for (const [index, message] of history.entries()) {
        if (message.sender === 'player' && detectIntent(message.text)?.id === 'goodbye') {
          priorGoodbyes += 1;
          lastGoodbyeIndex = index;
        }
        if (message.sender === 'npc') {
          priorNpcIndex = index;
          priorNpcMessage = message;
        }
      }
      const currentIsGoodbye = detectIntent(request.text)?.id === 'goodbye';
      const answeringFarewellQuestion = priorGoodbyes > 0 && priorNpcIndex > lastGoodbyeIndex
        && priorNpcMessage !== undefined && isDirectQuestion(priorNpcMessage.text);
      let metadata: TurnMetadata;
      let responseText: string;
      let nodeId: string;
      let aiResult: AiReplyResult | undefined;
      if ((SHOP_NPC_IDS as readonly string[]).includes(conversation.npc_id) && !(await this.life.venueOpen(client, userId, 'store'))) {
        const reply = await this.dialogue.node(context, 'global_store_closed');
        responseText = reply.text.replace('{hours}', venueHoursLabel('store'));
        nodeId = reply.node.id;
        metadata = { arrival, intent: 'shop_closed', misunderstood: false,
          ...(isCafeSeller(conversation.npc_id) || conversation.npc_id === 'npc_clothes_seller' ? { seller: sellerState(conversation) } : {}),
          ...([SELLER_NPC_ID, 'npc_cafe_waiter'].includes(conversation.npc_id) ? { coffeeQuest: await this.coffee.get(userId, client) } : {}) };
      } else if (isCafeSeller(conversation.npc_id) || conversation.npc_id === 'npc_clothes_seller') {
        const reply = await this.seller.reply(client, userId, conversation, context, request.text);
        responseText = reply.text; nodeId = reply.nodeId ?? `seller_${reply.intent}`;
        if (isCafeSeller(conversation.npc_id)) {
          const event = reply.intent === 'greet' ? 'greet' : reply.drinkPaid ? 'pay_drink' : reply.drinkOrdered ? 'order_drink'
            : ['cancel','goodbye','price_changed','order'].includes(reply.intent) && !reply.drinkOrdered ? 'cancel_order' : undefined;
          if (conversation.npc_id === SELLER_NPC_ID) {
            if (reply.greeted && event !== 'greet') await this.coffee.apply(client, userId, 'greet');
            const coffeeQuest = event ? await this.coffee.apply(client, userId, event) : await this.coffee.get(userId, client);
            metadata = { arrival, intent: reply.intent, misunderstood: reply.misunderstood, seller: reply.seller, coffeeQuest };
          } else metadata = { arrival, intent: reply.intent, misunderstood: reply.misunderstood, seller: reply.seller };
        } else metadata = { arrival, intent: reply.intent, misunderstood: reply.misunderstood, seller: reply.seller };
      } else {
        const reply = await this.dialogue.reply(context, request.text);
        responseText = reply.text; nodeId = reply.node.id;
        if (receptionist && reply.intent) arrival = await this.quests.applyReceptionistIntent(userId, ARRIVAL_NPC_ID, reply.intent, client);
        if (receptionist && (reply.intent === 'request_bus_ticket' || reply.intent === 'ask_town_directions')) {
          arrival = await this.quests.issueArrivalTicket(userId, client);
          const receipt = await this.dialogue.node(context, reply.intent === 'ask_town_directions'
            ? 'receptionist_directions_ticket_issued' : 'receptionist_ticket_issued');
          responseText = receipt.text; nodeId = receipt.node.id;
        }
        metadata = { arrival, intent: reply.intent, misunderstood: reply.misunderstood,
          ...(conversation.npc_id === 'npc_cafe_waiter' ? { coffeeQuest: await this.coffee.get(userId, client) } : {}) };
      }
      // All NPC roles reach this gate only after their authoritative scripts.
      // AI changes wording only; intents, node state and rewards stay scripted.
      if (this.ai.enabled && metadata.misunderstood && !currentIsGoodbye && !answeringFarewellQuestion
        && !conversation.pending_order && !metadata.seller?.pendingOrder
        && !metadata.seller?.closed && !await this.conversations.pendingQuest(client, userId, conversation.npc_id)) {
        if (await this.aiUsage.limited(client, userId)) {
          const limit = await this.dialogue.node(context, 'global_ai_limit');
          responseText = limit.text; nodeId = limit.node.id;
          metadata = { ...metadata, intent: null, misunderstood: false };
        } else {
          const prompt = await this.prompts.build(client, userId, conversation.npc_id, id, request.text);
          aiResult = stream
            ? await this.ai.replyTrackedStream(context, prompt.text, prompt.prompt, stream.beforeSave, stream.signal)
            : await this.ai.replyTracked(context, prompt.text, prompt.prompt);
          responseText = aiResult.text;
          metadata = { ...metadata, intent: null,
            ...(aiResult.usedProvider && !aiResult.fallback ? { ai: true as const } : {}) };
        }
      }
      if (!metadata.seller && currentIsGoodbye && priorGoodbyes === 0) {
        responseText = 'Before you go, will you come back tomorrow?';
        metadata = { ...metadata, farewellStage: 'question' };
      } else if (!metadata.seller && answeringFarewellQuestion) {
        responseText = farewellClosing(request.text);
        metadata = { ...metadata, farewellStage: 'confirm' };
      }
      const socialSignal = classifySocialSignal(request.text, metadata.intent);
      const relationship = socialSignal
        ? await this.relationships.apply(client, userId, conversation.npc_id, socialSignal, request.clientMessageId)
        : await this.relationships.context(client, userId, conversation.npc_id);
      const mood = await this.moods.resolve(client, userId, conversation.npc_id);
      metadata = { ...metadata, ...(socialSignal ? { relationship } : {}),
        effectiveMood: relationship.reactionMood ?? mood.id };
      if (stream && (!aiResult || aiResult.fallback)) {
        if (stream.signal.aborted) throw stream.signal.reason ?? new Error('Chat stream cancelled.');
        await stream.beforeSave(responseText);
        if (stream.signal.aborted) throw stream.signal.reason ?? new Error('Chat stream cancelled.');
      }
      if (history.length === 0 && conversation.current_node_id) {
        const openingContext = { ...context, variationIndex: conversation.opening_variation_index };
        const openingText = isCafeSeller(conversation.npc_id) || conversation.npc_id === 'npc_clothes_seller'
          ? await this.seller.opening(openingContext)
          : (await this.dialogue.node(openingContext, conversation.current_node_id)).text;
        await this.conversations.append(client, id, 'npc', openingText, null, null, openingMessageId(id));
      }
      const playerMessage = await this.conversations.append(client, id, 'player', request.text,
        request.clientMessageId);
      const npcMessage = await this.conversations.append(client, id, 'npc', responseText, request.clientMessageId, metadata);
      await this.conversations.setNode(client, id, nodeId);
      if (aiResult) await this.aiUsage.record(client, userId, id, request.clientMessageId, aiResult);
      return { npcId: conversationNpcSchema.parse(conversation.npc_id),
        turn: { ...metadata, playerMessage, npcMessage } };
    });
    return this.speech.turn(userId, result.npcId, result.turn);
  }
}
