import { ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ARRIVAL_NPC_ID, ARRIVAL_QUEST_ID, CAFE_SELLER_NPC_IDS, TAX_OFFICE_NPC_IDS, TOWN_STREET_NPC_IDS, TRANSIENT_SERVICE_NPC_IDS, ConversationHistoryPage, ConversationMessage, ConversationTurn, SendMessageRequest, TurnMetadata, turnMetadataSchema, pendingOrderSchema, npcProfileSchema, SHOP_NPC_IDS, type PendingOrder, type SellerState } from '@life-abroad/shared';
import { PoolClient } from 'pg';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { DialogueContext } from '../dialogue/dialogue.service';
import { conversationNpcSchema } from '@life-abroad/shared';

interface MessageRow { id: string; sender: 'player' | 'npc'; text: string; created_at: Date; metadata: unknown }
export interface ConversationRow { id: string; npc_id: string; current_node_id: string | null; opening_variation_index: number; pending_order: unknown; ended_at: Date | null }

export function sellerState(row: ConversationRow): SellerState {
  return { shop: row.npc_id === 'npc_clothes_seller' ? 'clothes' : 'cafe', pendingOrder: row.pending_order ? pendingOrderSchema.parse(row.pending_order) : null,
    closed: row.ended_at !== null };
}

function message(row: MessageRow): ConversationMessage {
  const ai = row.sender === 'npc' && (row.metadata as { ai?: unknown } | null)?.ai === true;
  return { id: row.id, sender: row.sender, text: row.text, createdAt: row.created_at.toISOString(), ...(ai ? { ai: true as const } : {}) };
}

@Injectable()
export class ConversationsRepository {
  constructor(private readonly database: DatabaseService) {}
  transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> { return this.database.transaction(work); }

  async pendingQuest(client: PoolClient, userId: string, npcId: string): Promise<boolean> {
    const result = await client.query<{ pending: boolean }>(`SELECT EXISTS (
      SELECT 1 FROM public.player_quests p JOIN public.quests q ON q.id=p.quest_id
      WHERE p.user_id=$1 AND q.npc_id=$2 AND p.status='active' AND p.current_step_id IS NOT NULL
    ) AS pending`, [userId, npcId]);
    return result.rows[0]!.pending;
  }

  async variationIndex(client: PoolClient, userId: string, npcId: string, opening = false): Promise<number> {
    const result = await client.query<{ count: string }>(opening
      ? 'SELECT count(*) FROM public.conversations WHERE user_id=$1 AND npc_id=$2'
      : `SELECT count(*) FROM public.messages m
      JOIN public.conversations c ON c.id=m.conversation_id
      WHERE c.user_id=$1 AND c.npc_id=$2 AND m.sender='npc'`, [userId, npcId]);
    return Number(result.rows[0]?.count ?? 0);
  }

  async context(client: PoolClient, userId: string, npcId: string = ARRIVAL_NPC_ID): Promise<DialogueContext> {
    const result = await client.query<{ name: string; role_id: string; personality: string; profile: unknown;
      location_name: string; city_name: string; country_name: string; town_location_name: string }>(`SELECT n.name,n.role_id,n.personality,n.profile,
      l.name AS location_name,ci.name AS city_name,co.name AS country_name,
      (SELECT name FROM public.locations WHERE city_id=ci.id AND type='street' ORDER BY id LIMIT 1) AS town_location_name
      FROM public.npcs n
      JOIN public.locations l ON l.id=n.location_id
      JOIN public.characters ch ON ch.user_id=$1
      JOIN public.countries co ON co.id=ch.country_id
      JOIN public.cities ci ON ci.id=co.starter_city_id
      WHERE n.id=$2`, [userId, npcId]);
    const npc = result.rows[0];
    if (!npc) throw new ServiceUnavailableException('NPC content is unavailable');
    return { npcId, npcName: npc.name, roleId: npc.role_id, personality: npc.personality,
      profile: npcProfileSchema.parse(npc.profile), locationName: npc.location_name,
      cityName: npc.city_name, countryName: npc.country_name,
      townLocationName: npc.town_location_name,
      store: (SHOP_NPC_IDS as readonly string[]).includes(npcId) };
  }

  async create(client: PoolClient, userId: string, npcId: string = ARRIVAL_NPC_ID, openingVariation = 0): Promise<string> {
    const result = await client.query<{ id: string }>(`INSERT INTO public.conversations
      (user_id,npc_id,quest_id,current_node_id,opening_variation_index) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [userId, npcId, npcId === ARRIVAL_NPC_ID ? ARRIVAL_QUEST_ID : null,
      npcId === ARRIVAL_NPC_ID ? 'receptionist_start' : (CAFE_SELLER_NPC_IDS as readonly string[]).includes(npcId) ? 'seller_start'
        : npcId === 'npc_clothes_seller' ? 'clothes_seller_start'
          : (TOWN_STREET_NPC_IDS as readonly string[]).includes(npcId) ? 'townsperson_start'
            : (TAX_OFFICE_NPC_IDS as readonly string[]).includes(npcId) ? 'tax_office_start' : 'shop_start', openingVariation]);
    return result.rows[0]!.id;
  }

  async load(client: PoolClient, userId: string, id: string): Promise<ConversationRow> {
    const result = await client.query<ConversationRow>(
      'SELECT id,npc_id,current_node_id,opening_variation_index,pending_order,ended_at FROM public.conversations WHERE id=$1 AND user_id=$2 FOR UPDATE', [id, userId]);
    const row = result.rows[0];
    if (!row) throw new NotFoundException('Conversation not found');
    if (!conversationNpcSchema.safeParse(row.npc_id).success) throw new ConflictException('Unsupported conversation NPC');
    return row;
  }

  async messages(client: PoolClient, id: string): Promise<ConversationMessage[]> {
    const result = await client.query<MessageRow>('SELECT id,sender,text,created_at,metadata FROM public.messages WHERE conversation_id=$1 ORDER BY sequence', [id]);
    return result.rows.map(message);
  }

  async olderMessages(client: PoolClient, userId: string, npcId: string, before: string | undefined): Promise<ConversationHistoryPage> {
    if ((TRANSIENT_SERVICE_NPC_IDS as readonly string[]).includes(npcId)) {
      return { messages: [], hasMore: false, beforeMessageId: null };
    }
    const result = await client.query<MessageRow>(`SELECT id,sender,text,created_at,metadata FROM public.messages
      WHERE conversation_id IN (SELECT id FROM public.conversations WHERE user_id=$1 AND npc_id=$2)
        AND ($3::uuid IS NULL OR (created_at,conversation_id,sequence) < (
          SELECT m.created_at,m.conversation_id,m.sequence FROM public.messages m
          JOIN public.conversations c ON c.id=m.conversation_id
          WHERE m.id=$3 AND c.user_id=$1 AND c.npc_id=$2))
      ORDER BY created_at DESC,conversation_id DESC,sequence DESC LIMIT 11`, [userId, npcId, before ?? null]);
    const hasMore = result.rows.length > 10;
    const page = result.rows.slice(0, 10).reverse().map(message);
    return { messages: page, hasMore, beforeMessageId: hasMore ? page[0]?.id ?? null : null };
  }

  async discardTransient(client: PoolClient, userId: string, id: string): Promise<void> {
    await client.query(`DELETE FROM public.conversations
      WHERE id=$1 AND user_id=$2 AND npc_id=ANY($3::text[])`, [id, userId, TRANSIENT_SERVICE_NPC_IDS]);
  }

  async discardAllTransient(client: PoolClient, userId: string): Promise<void> {
    await client.query('DELETE FROM public.conversations WHERE user_id=$1 AND npc_id=ANY($2::text[])',
      [userId, TRANSIENT_SERVICE_NPC_IDS]);
  }

  async discardTransientForNpc(client: PoolClient, userId: string, npcId: string): Promise<void> {
    if (!(TRANSIENT_SERVICE_NPC_IDS as readonly string[]).includes(npcId)) return;
    await client.query('DELETE FROM public.conversations WHERE user_id=$1 AND npc_id=$2', [userId, npcId]);
  }

  async replay(client: PoolClient, id: string, request: SendMessageRequest): Promise<ConversationTurn | undefined> {
    const result = await client.query<MessageRow>(`SELECT id,sender,text,created_at,metadata FROM public.messages
      WHERE conversation_id=$1 AND client_message_id=$2 ORDER BY sequence`, [id, request.clientMessageId]);
    if (!result.rows.length) return undefined;
    const player = result.rows.find(row => row.sender === 'player');
    const npc = result.rows.find(row => row.sender === 'npc');
    if (!player || !npc) throw new ServiceUnavailableException('Conversation replay is unavailable');
    if (player.text !== request.text) {
      throw new ConflictException('Message ID was already used for a different request');
    }
    return { ...turnMetadataSchema.parse(npc.metadata), playerMessage: message(player), npcMessage: message(npc) };
  }

  async append(client: PoolClient, id: string, sender: 'player' | 'npc', text: string,
    requestId: string | null = null, metadata: TurnMetadata | null = null,
    messageId?: string): Promise<ConversationMessage> {
    const result = await client.query<MessageRow>(`INSERT INTO public.messages
      (id,conversation_id,sender,text,client_message_id,metadata) VALUES (COALESCE($1::uuid,gen_random_uuid()),$2,$3,$4,$5,$6)
      RETURNING id,sender,text,created_at,metadata`, [messageId ?? null, id, sender, text, requestId, metadata]);
    return message(result.rows[0]!);
  }

  async setNode(client: PoolClient, id: string, nodeId: string): Promise<void> {
    await client.query('UPDATE public.conversations SET current_node_id=$2 WHERE id=$1', [id, nodeId]);
  }

  async saveOrder(client: PoolClient, id: string, order: PendingOrder | null, closed: boolean): Promise<void> {
    await client.query('UPDATE public.conversations SET pending_order=$2,ended_at=CASE WHEN $3 THEN now() ELSE NULL END WHERE id=$1',
      [id, order, closed]);
  }
}
