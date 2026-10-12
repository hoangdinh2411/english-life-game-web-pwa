import { LifeService } from '../life/life.service';
import { ConflictException, Injectable } from '@nestjs/common';
import { ARRIVAL_NPC_ID, SELLER_NPC_ID, SHOP_NPC_IDS, checkGrammar, Conversation, ConversationTurn, SendMessageRequest, STATION_LOCATION_ID, TurnMetadata, venueHoursLabel } from '@life-abroad/shared';
import { DialogueService } from '../dialogue/dialogue.service';
import { QuestsService } from '../quests/quests.service';
import { ConversationsRepository, sellerState } from './conversations.repository';
import { SellerService } from './seller.service';
import { conversationNpcSchema } from '@life-abroad/shared';
import { CoffeeQuestService } from '../quests/coffee-quest.service';

@Injectable()
export class ConversationsService {
  constructor(private readonly conversations: ConversationsRepository,
    private readonly dialogue: DialogueService, private readonly quests: QuestsService, private readonly life: LifeService,
    private readonly seller: SellerService, private readonly coffee: CoffeeQuestService) {}

  create(userId: string, npcId: string = ARRIVAL_NPC_ID): Promise<Conversation> {
    return this.conversations.transaction(async client => {
      const arrival = await this.quests.getArrival(userId, client);
      if (npcId === SELLER_NPC_ID || npcId === 'npc_clothes_seller') {
        const context = { ...await this.conversations.context(client, npcId), variationIndex: await this.conversations.variationIndex(client, userId, npcId, true) };
        const id = await this.conversations.create(client, userId, npcId);
        const greeting = await this.conversations.append(client, id, 'npc', await this.seller.opening(context));
        const seller = { shop: npcId === 'npc_clothes_seller' ? 'clothes' as const : 'cafe' as const,
          pendingOrder: null, closed: false };
        return { id, npcId: conversationNpcSchema.parse(npcId), messages: [greeting], arrival, seller,
          ...(npcId === SELLER_NPC_ID ? { coffeeQuest: await this.coffee.get(userId, client) } : {}) };
      }
      if (npcId !== ARRIVAL_NPC_ID) {
        const context = { ...await this.conversations.context(client, npcId), variationIndex: await this.conversations.variationIndex(client, userId, npcId, true) };
        const opening = await this.dialogue.node(context, 'shop_start');
        const id = await this.conversations.create(client, userId, npcId);
        const greeting = await this.conversations.append(client, id, 'npc', opening.text);
        return { id, npcId: conversationNpcSchema.parse(npcId), messages: [greeting], arrival,
          ...(npcId === 'npc_cafe_waiter' ? { coffeeQuest: await this.coffee.get(userId, client) } : {}) };
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
        ...([SELLER_NPC_ID, 'npc_clothes_seller'].includes(row.npc_id) ? { seller: sellerState(row) } : {}),
        ...([SELLER_NPC_ID,'npc_cafe_waiter'].includes(row.npc_id) ? { coffeeQuest: await this.coffee.get(userId, client) } : {}) };
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
      if ((SHOP_NPC_IDS as readonly string[]).includes(conversation.npc_id) && !(await this.life.venueOpen(client, userId, 'store'))) {
        const reply = await this.dialogue.node(context, 'global_store_closed');
        responseText = reply.text.replace('{hours}', venueHoursLabel('store'));
        nodeId = reply.node.id;
        metadata = { arrival, intent: 'shop_closed', misunderstood: false, correction,
          ...([SELLER_NPC_ID, 'npc_clothes_seller'].includes(conversation.npc_id) ? { seller: sellerState(conversation) } : {}),
          ...([SELLER_NPC_ID, 'npc_cafe_waiter'].includes(conversation.npc_id) ? { coffeeQuest: await this.coffee.get(userId, client) } : {}) };
      } else if (conversation.npc_id === SELLER_NPC_ID || conversation.npc_id === 'npc_clothes_seller') {
        const reply = await this.seller.reply(client, userId, conversation, context, request.text);
        responseText = reply.text; nodeId = reply.nodeId ?? `seller_${reply.intent}`;
        if (conversation.npc_id === SELLER_NPC_ID) {
          const event = reply.intent === 'greet' ? 'greet' : reply.drinkPaid ? 'pay_drink' : reply.drinkOrdered ? 'order_drink'
            : ['cancel','goodbye','price_changed','order'].includes(reply.intent) && !reply.drinkOrdered ? 'cancel_order' : undefined;
          if (reply.greeted && event !== 'greet') await this.coffee.apply(client, userId, 'greet');
          const coffeeQuest = event ? await this.coffee.apply(client, userId, event) : await this.coffee.get(userId, client);
          metadata = { arrival, intent: reply.intent, misunderstood: reply.misunderstood, seller: reply.seller, correction, coffeeQuest };
        } else metadata = { arrival, intent: reply.intent, misunderstood: reply.misunderstood, seller: reply.seller, correction };
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
        metadata = { arrival, intent: reply.intent, misunderstood: reply.misunderstood, correction,
          ...(conversation.npc_id === 'npc_cafe_waiter' ? { coffeeQuest: await this.coffee.get(userId, client) } : {}) };
      }
      const playerMessage = await this.conversations.append(client, id, 'player', request.text,
        request.clientMessageId, { coach: request.coach });
      const npcMessage = await this.conversations.append(client, id, 'npc', responseText, request.clientMessageId, metadata);
      await this.conversations.setNode(client, id, nodeId);
      return { ...metadata, playerMessage, npcMessage };
    });
  }
}
