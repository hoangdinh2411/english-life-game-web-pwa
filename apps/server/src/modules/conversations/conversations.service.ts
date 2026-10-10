import { ConflictException, Injectable } from '@nestjs/common';
import { ARRIVAL_NPC_ID, checkGrammar, Conversation, ConversationTurn, SendMessageRequest, STATION_LOCATION_ID, TurnMetadata } from '@life-abroad/shared';
import { DialogueService } from '../dialogue/dialogue.service';
import { QuestsService } from '../quests/quests.service';
import { ConversationsRepository } from './conversations.repository';

@Injectable()
export class ConversationsService {
  constructor(private readonly conversations: ConversationsRepository,
    private readonly dialogue: DialogueService, private readonly quests: QuestsService) {}

  create(userId: string): Promise<Conversation> {
    return this.conversations.transaction(async client => {
      const arrival = await this.quests.getArrival(userId, client);
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
      await this.conversations.load(client, userId, id);
      return { id, npcId: ARRIVAL_NPC_ID, arrival, messages: await this.conversations.messages(client, id) };
    });
  }

  send(userId: string, id: string, request: SendMessageRequest): Promise<ConversationTurn> {
    return this.conversations.transaction(async client => {
      // Always lock the character before the conversation, matching quest lock order.
      let arrival = await this.quests.getArrival(userId, client);
      const conversation = await this.conversations.load(client, userId, id);
      const replay = await this.conversations.replay(client, id, request);
      if (replay) return replay;
      if (arrival.locationId !== STATION_LOCATION_ID) throw new ConflictException('Visit the station receptionist first');
      const context = { ...await this.conversations.context(client),
        ...(conversation.current_node_id ? { currentNodeId: conversation.current_node_id } : {}) };
      const reply = await this.dialogue.reply(context, request.text);
      if (reply.intent) arrival = await this.quests.applyReceptionistIntent(userId, ARRIVAL_NPC_ID, reply.intent, client);
      let responseText = reply.text;
      let nodeId = reply.node.id;
      if (reply.intent === 'request_bus_ticket' || reply.intent === 'ask_town_directions') {
        arrival = await this.quests.issueArrivalTicket(userId, client);
        const receiptId = reply.intent === 'ask_town_directions'
          ? 'receptionist_directions_ticket_issued'
          : 'receptionist_ticket_issued';
        const receipt = await this.dialogue.node(context, receiptId);
        responseText = receipt.text;
        nodeId = receipt.node.id;
      }
      const metadata: TurnMetadata = { arrival, intent: reply.intent, misunderstood: reply.misunderstood,
        correction: request.coach ? checkGrammar(request.text) ?? null : null };
      const playerMessage = await this.conversations.append(client, id, 'player', request.text,
        request.clientMessageId, { coach: request.coach });
      const npcMessage = await this.conversations.append(client, id, 'npc', responseText, request.clientMessageId, metadata);
      await this.conversations.setNode(client, id, nodeId);
      return { ...metadata, playerMessage, npcMessage };
    });
  }
}
