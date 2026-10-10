import { ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ARRIVAL_NPC_ID, ARRIVAL_QUEST_ID, ConversationMessage, ConversationTurn, SendMessageRequest, TurnMetadata, turnMetadataSchema } from '@life-abroad/shared';
import { PoolClient } from 'pg';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { DialogueContext } from '../dialogue/dialogue.service';

interface MessageRow { id: string; sender: 'player' | 'npc'; text: string; created_at: Date; metadata: unknown }
interface ConversationRow { id: string; npc_id: string; current_node_id: string | null }

function message(row: MessageRow): ConversationMessage {
  return { id: row.id, sender: row.sender, text: row.text, createdAt: row.created_at.toISOString() };
}

@Injectable()
export class ConversationsRepository {
  constructor(private readonly database: DatabaseService) {}
  transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> { return this.database.transaction(work); }

  async context(client: PoolClient): Promise<DialogueContext> {
    const result = await client.query<{ role_id: string; personality: string }>(
      'SELECT role_id,personality FROM public.npcs WHERE id=$1', [ARRIVAL_NPC_ID]);
    const npc = result.rows[0];
    if (!npc) throw new ServiceUnavailableException('Receptionist content is unavailable');
    return { npcId: ARRIVAL_NPC_ID, roleId: npc.role_id, personality: npc.personality };
  }

  async create(client: PoolClient, userId: string): Promise<string> {
    const result = await client.query<{ id: string }>(`INSERT INTO public.conversations
      (user_id,npc_id,quest_id,current_node_id) VALUES ($1,$2,$3,'receptionist_start') RETURNING id`,
    [userId, ARRIVAL_NPC_ID, ARRIVAL_QUEST_ID]);
    return result.rows[0]!.id;
  }

  async load(client: PoolClient, userId: string, id: string): Promise<ConversationRow> {
    const result = await client.query<ConversationRow>(
      'SELECT id,npc_id,current_node_id FROM public.conversations WHERE id=$1 AND user_id=$2 FOR UPDATE', [id, userId]);
    const row = result.rows[0];
    if (!row) throw new NotFoundException('Conversation not found');
    if (row.npc_id !== ARRIVAL_NPC_ID) throw new ConflictException('Only station receptionist conversations are supported');
    return row;
  }

  async messages(client: PoolClient, id: string): Promise<ConversationMessage[]> {
    const result = await client.query<MessageRow>('SELECT id,sender,text,created_at,metadata FROM public.messages WHERE conversation_id=$1 ORDER BY sequence', [id]);
    return result.rows.map(message);
  }

  async replay(client: PoolClient, id: string, request: SendMessageRequest): Promise<ConversationTurn | undefined> {
    const result = await client.query<MessageRow>(`SELECT id,sender,text,created_at,metadata FROM public.messages
      WHERE conversation_id=$1 AND client_message_id=$2 ORDER BY sequence`, [id, request.clientMessageId]);
    if (!result.rows.length) return undefined;
    const player = result.rows.find(row => row.sender === 'player');
    const npc = result.rows.find(row => row.sender === 'npc');
    if (!player || !npc) throw new ServiceUnavailableException('Conversation replay is unavailable');
    if (player.text !== request.text || (player.metadata as { coach?: unknown } | null)?.coach !== request.coach) {
      throw new ConflictException('Message ID was already used for a different request');
    }
    return { ...turnMetadataSchema.parse(npc.metadata), playerMessage: message(player), npcMessage: message(npc) };
  }

  async append(client: PoolClient, id: string, sender: 'player' | 'npc', text: string,
    requestId: string | null = null, metadata: TurnMetadata | { coach: boolean } | null = null): Promise<ConversationMessage> {
    const result = await client.query<MessageRow>(`INSERT INTO public.messages
      (conversation_id,sender,text,client_message_id,metadata) VALUES ($1,$2,$3,$4,$5)
      RETURNING id,sender,text,created_at,metadata`, [id, sender, text, requestId, metadata]);
    return message(result.rows[0]!);
  }

  async setNode(client: PoolClient, id: string, nodeId: string): Promise<void> {
    await client.query('UPDATE public.conversations SET current_node_id=$2 WHERE id=$1', [id, nodeId]);
  }
}
