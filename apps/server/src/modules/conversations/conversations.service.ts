import { LifeService } from '../life/life.service';
import { ConflictException, Injectable } from '@nestjs/common';
import { ARRIVAL_NPC_ID, CAFE_SELLER_NPC_IDS, SELLER_NPC_ID, TOWN_STREET_NPC_IDS, Conversation, ConversationTurn, SendMessageRequest, STATION_LOCATION_ID } from '@life-abroad/shared';
import { DialogueService } from '../dialogue/dialogue.service';
import { QuestsService } from '../quests/quests.service';
import { ConversationsRepository, sellerState } from './conversations.repository';
import { SellerService } from './seller.service';
import { conversationNpcSchema } from '@life-abroad/shared';
import { CoffeeQuestService } from '../quests/coffee-quest.service';
import type { ConversationHistoryPage } from '@life-abroad/shared';
import { ConversationSpeechService } from '../speech/conversation-speech.service';
import { NpcPresenceService } from '../npcs/npc-presence.service';
import { openingMessageId, transientOpening } from './conversation-policy';
import { ConversationReplyService, type ConversationStream } from './conversation-reply.service';

const isCafeSeller = (npcId: string): boolean => (CAFE_SELLER_NPC_IDS as readonly string[]).includes(npcId);

@Injectable()
export class ConversationsService {
  constructor(private readonly conversations: ConversationsRepository,
    private readonly dialogue: DialogueService, private readonly quests: QuestsService, private readonly life: LifeService,
    private readonly seller: SellerService, private readonly coffee: CoffeeQuestService,
    private readonly replies: ConversationReplyService, private readonly speech: ConversationSpeechService,
    private readonly presence: NpcPresenceService) {}

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
    stream?: ConversationStream): Promise<ConversationTurn> {
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
      const reply = await this.replies.resolve({ client, userId, conversationId: id,
        conversation, context, history, request, arrival, ...(stream ? { stream } : {}) });
      arrival = reply.arrival;
      if (history.length === 0 && conversation.current_node_id) {
        const openingContext = { ...context, variationIndex: conversation.opening_variation_index };
        const openingText = isCafeSeller(conversation.npc_id) || conversation.npc_id === 'npc_clothes_seller'
          ? await this.seller.opening(openingContext)
          : (await this.dialogue.node(openingContext, conversation.current_node_id)).text;
        await this.conversations.append(client, id, 'npc', openingText, null, null, openingMessageId(id));
      }
      const playerMessage = await this.conversations.append(client, id, 'player', request.text,
        request.clientMessageId);
      const npcMessage = await this.conversations.append(client, id, 'npc', reply.responseText,
        request.clientMessageId, reply.metadata);
      await this.conversations.setNode(client, id, reply.nodeId);
      if (reply.aiResult) await this.replies.recordAiUsage(client, userId, id, request.clientMessageId, reply.aiResult);
      return { npcId: conversationNpcSchema.parse(conversation.npc_id),
        turn: { ...reply.metadata, playerMessage, npcMessage } };
    });
    return this.speech.turn(userId, result.npcId, result.turn);
  }
}
