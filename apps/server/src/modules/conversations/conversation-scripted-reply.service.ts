import { Injectable } from '@nestjs/common';
import {
  ARRIVAL_NPC_ID,
  CAFE_SELLER_NPC_IDS,
  SELLER_NPC_ID,
  SHOP_NPC_IDS,
  venueHoursLabel,
  type ArrivalState,
  type SendMessageRequest,
  type TurnMetadata,
} from '@life-abroad/shared';
import type { PoolClient } from 'pg';
import { DialogueService, type DialogueContext } from '../dialogue/dialogue.service';
import { LifeService } from '../life/life.service';
import { CoffeeQuestService } from '../quests/coffee-quest.service';
import { QuestsService } from '../quests/quests.service';
import { sellerState, type ConversationRow } from './conversations.repository';
import { SellerService } from './seller.service';

interface ResolveScriptedReplyOptions {
  client: PoolClient;
  userId: string;
  conversation: ConversationRow;
  context: DialogueContext;
  request: SendMessageRequest;
  arrival: ArrivalState;
}

export interface ScriptedConversationReply {
  arrival: ArrivalState;
  metadata: TurnMetadata;
  nodeId: string;
  responseText: string;
}

const isCafeSeller = (npcId: string): boolean =>
  (CAFE_SELLER_NPC_IDS as readonly string[]).includes(npcId);

@Injectable()
export class ConversationScriptedReplyService {
  constructor(
    private readonly dialogue: DialogueService,
    private readonly quests: QuestsService,
    private readonly life: LifeService,
    private readonly seller: SellerService,
    private readonly coffee: CoffeeQuestService,
  ) {}

  async resolve(
    options: ResolveScriptedReplyOptions,
  ): Promise<ScriptedConversationReply> {
    const { client, userId, conversation, context, request } = options;
    let { arrival } = options;
    const receptionist = conversation.npc_id === ARRIVAL_NPC_ID;

    if (
      (SHOP_NPC_IDS as readonly string[]).includes(conversation.npc_id) &&
      !(await this.life.venueOpen(client, userId, 'store'))
    ) {
      const reply = await this.dialogue.node(context, 'global_store_closed');
      return {
        arrival,
        responseText: reply.text.replace('{hours}', venueHoursLabel('store')),
        nodeId: reply.node.id,
        metadata: {
          arrival,
          intent: 'shop_closed',
          misunderstood: false,
          ...(isCafeSeller(conversation.npc_id) ||
          conversation.npc_id === 'npc_clothes_seller'
            ? { seller: sellerState(conversation) }
            : {}),
          ...([SELLER_NPC_ID, 'npc_cafe_waiter'].includes(conversation.npc_id)
            ? { coffeeQuest: await this.coffee.get(userId, client) }
            : {}),
        },
      };
    }

    if (
      isCafeSeller(conversation.npc_id) ||
      conversation.npc_id === 'npc_clothes_seller'
    ) {
      return this.resolveSeller(options);
    }

    const reply = await this.dialogue.reply(context, request.text);
    let responseText = reply.text;
    let nodeId = reply.node.id;
    if (receptionist && reply.intent) {
      arrival = await this.quests.applyReceptionistIntent(
        userId,
        ARRIVAL_NPC_ID,
        reply.intent,
        client,
      );
    }
    if (
      receptionist &&
      (reply.intent === 'request_bus_ticket' ||
        reply.intent === 'ask_town_directions')
    ) {
      arrival = await this.quests.issueArrivalTicket(userId, client);
      const receipt = await this.dialogue.node(
        context,
        reply.intent === 'ask_town_directions'
          ? 'receptionist_directions_ticket_issued'
          : 'receptionist_ticket_issued',
      );
      responseText = receipt.text;
      nodeId = receipt.node.id;
    }
    return {
      arrival,
      responseText,
      nodeId,
      metadata: {
        arrival,
        intent: reply.intent,
        misunderstood: reply.misunderstood,
        ...(conversation.npc_id === 'npc_cafe_waiter'
          ? { coffeeQuest: await this.coffee.get(userId, client) }
          : {}),
      },
    };
  }

  private async resolveSeller(
    options: ResolveScriptedReplyOptions,
  ): Promise<ScriptedConversationReply> {
    const { client, userId, conversation, context, request, arrival } = options;
    const reply = await this.seller.reply(
      client,
      userId,
      conversation,
      context,
      request.text,
    );
    const base = {
      arrival,
      responseText: reply.text,
      nodeId: reply.nodeId ?? `seller_${reply.intent}`,
    };
    if (!isCafeSeller(conversation.npc_id)) {
      return {
        ...base,
        metadata: {
          arrival,
          intent: reply.intent,
          misunderstood: reply.misunderstood,
          seller: reply.seller,
        },
      };
    }

    const event =
      reply.intent === 'greet'
        ? 'greet'
        : reply.drinkPaid
          ? 'pay_drink'
          : reply.drinkOrdered
            ? 'order_drink'
            : ['cancel', 'goodbye', 'price_changed', 'order'].includes(
                  reply.intent,
                ) && !reply.drinkOrdered
              ? 'cancel_order'
              : undefined;
    if (conversation.npc_id !== SELLER_NPC_ID) {
      return {
        ...base,
        metadata: {
          arrival,
          intent: reply.intent,
          misunderstood: reply.misunderstood,
          seller: reply.seller,
        },
      };
    }
    if (reply.greeted && event !== 'greet') {
      await this.coffee.apply(client, userId, 'greet');
    }
    const coffeeQuest = event
      ? await this.coffee.apply(client, userId, event)
      : await this.coffee.get(userId, client);
    return {
      ...base,
      metadata: {
        arrival,
        intent: reply.intent,
        misunderstood: reply.misunderstood,
        seller: reply.seller,
        coffeeQuest,
      },
    };
  }
}
