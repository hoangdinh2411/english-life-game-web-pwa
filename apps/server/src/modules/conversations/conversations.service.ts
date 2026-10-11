import { LifeService } from '../life/life.service';
import { ConflictException, Injectable } from '@nestjs/common';
import { ARRIVAL_NPC_ID, SELLER_NPC_ID, checkGrammar, Conversation, ConversationTurn, SendMessageRequest, STATION_LOCATION_ID, TurnMetadata } from '@life-abroad/shared';
import { DialogueService } from '../dialogue/dialogue.service';
import { QuestsService } from '../quests/quests.service';
import { ConversationsRepository, sellerState } from './conversations.repository';
import { SellerService } from './seller.service';
import { conversationNpcSchema } from '@life-abroad/shared';

@Injectable()
export class ConversationsService {
  constructor(private readonly conversations: ConversationsRepository,
    private readonly dialogue: DialogueService, private readonly quests: QuestsService, private readonly life: LifeService,
    private readonly seller: SellerService) {}

  create(userId: string, npcId: string = ARRIVAL_NPC_ID): Promise<Conversation> {
    return this.conversations.transaction(async client => {
      const arrival = await this.quests.getArrival(userId, client);
      if (npcId === SELLER_NPC_ID) {
        const context = { ...await this.conversations.context(client, npcId), variationIndex: await this.conversations.variationIndex(client, userId, npcId, true) };
        const id = await this.conversations.create(client, userId, npcId);
        const greeting = await this.conversations.append(client, id, 'npc', await this.seller.opening(context));
        return { id, npcId: SELLER_NPC_ID, messages: [greeting], arrival,
          seller: { shop: 'cafe', pendingOrder: null, closed: false } };
      }
      if (npcId !== ARRIVAL_NPC_ID) {
        const context = { ...await this.conversations.context(client, npcId), variationIndex: await this.conversations.variationIndex(client, userId, npcId, true) };
        const opening = await this.dialogue.node(context, 'shop_start');
        const id = await this.conversations.create(client, userId, npcId);
        const greeting = await this.conversations.append(client, id, 'npc', opening.text);
        return { id, npcId: conversationNpcSchema.parse(npcId), messages: [greeting], arrival };
      }
      if (arrival.locationId !== STATION_LOCATION_ID) throw new ConflictException('Visit the station receptionist first');
      const context = await this.conversations.context(client);
      const opening = await this.dialogue.node(context, 'receptionist_start');
      const id = await this.conversations.create(client, userId);
      const greeting = await this.conversations.append(client, id, 'npc', opening.text);
      return { id, npcId: ARRIVAL_NPC_ID, messages: [greeting], arrival };
    });
  }

  get(userId: string, id: string): Promise<Conversation> {
    return this.conversations.transaction(async client => {
      const arrival = await this.quests.getArrival(userId, client);
      const row = await this.conversations.load(client, userId, id);
      return { id, npcId: conversationNpcSchema.parse(row.npc_id),
        arrival, messages: await this.conversations.messages(client, id),
        ...(row.npc_id === SELLER_NPC_ID ? { seller: sellerState(row) } : {}) };
    });
  }

  send(userId: string, id: string, request: SendMessageRequest): Promise<ConversationTurn> {
    return this.conversations.transaction(async client => {
      // Always lock the character before the conversation, matching quest lock order.
      let arrival = await this.quests.getArrival(userId, client);
      const conversation = await this.conversations.load(client, userId, id);
      const replay = await this.conversations.replay(client, id, request);
      if (replay) return replay;
      const receptionist = conversation.npc_id === ARRIVAL_NPC_ID;
      if (conversation.ended_at) throw new ConflictException('This conversation has ended. Start a new conversation');
      if (receptionist && arrival.locationId !== STATION_LOCATION_ID) throw new ConflictException('Visit the station receptionist first');
      await this.life.consumeMessage(client, userId);
      const context = { ...await this.conversations.context(client, conversation.npc_id),
        variationIndex: await this.conversations.variationIndex(client, userId, conversation.npc_id),
        ...(conversation.current_node_id ? { currentNodeId: conversation.current_node_id } : {}) };
      const correction = request.coach ? checkGrammar(request.text) ?? null : null;
      let metadata: TurnMetadata;
      let responseText: string;
      let nodeId: string;
      if (conversation.npc_id === SELLER_NPC_ID) {
        const reply = await this.seller.reply(client, userId, conversation, context, request.text);
        responseText = reply.text; nodeId = `seller_${reply.intent}`;
        metadata = { arrival, intent: reply.intent, misunderstood: reply.misunderstood, seller: reply.seller, correction };
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
        metadata = { arrival, intent: reply.intent, misunderstood: reply.misunderstood, correction };
      }
      const playerMessage = await this.conversations.append(client, id, 'player', request.text,
        request.clientMessageId, { coach: request.coach });
      const npcMessage = await this.conversations.append(client, id, 'npc', responseText, request.clientMessageId, metadata);
      await this.conversations.setNode(client, id, nodeId);
      return { ...metadata, playerMessage, npcMessage };
    });
  }
}
