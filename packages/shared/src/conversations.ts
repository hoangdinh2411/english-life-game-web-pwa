import { z } from 'zod';
import { ARRIVAL_NPC_ID, arrivalStateSchema, coffeeQuestStateSchema } from './quests';
import { moodIdSchema } from './content';
import { idCardApplicationSummarySchema } from './id-card';

export const SELLER_NPC_ID = 'npc_mia';
export const CAFE_SELLER_NPC_IDS = ['npc_mia', 'npc_corner_cup_seller'] as const;
export const SHOP_NPC_IDS = [
  ...CAFE_SELLER_NPC_IDS,
  'npc_cafe_waiter', 'npc_cafe_customer',
  'npc_corner_cup_assistant', 'npc_corner_cup_customer_1', 'npc_corner_cup_customer_2', 'npc_corner_cup_customer_3',
  'npc_clothes_seller', 'npc_clothes_assistant', 'npc_clothes_customer',
] as const;
export const TOWN_STREET_NPC_IDS = [
  'npc_mila_florist', 'npc_amir_courier', 'npc_ethan_baker',
  'npc_lina_librarian', 'npc_ben_gardener', 'npc_maya_teacher',
  'npc_raj_pharmacist', 'npc_nora_bookseller', 'npc_leo_driver',
  'npc_dani_mechanic', 'npc_amara_market_vendor', 'npc_owen_post_worker',
  'npc_sara_artist', 'npc_jamal_dog_walker', 'npc_tara_musician',
] as const;
export const TAX_OFFICE_NPC_IDS = ['npc_tax_clerk_marcus', 'npc_tax_clerk_nadia'] as const;
export const TRANSIENT_SERVICE_NPC_IDS = [
  ...CAFE_SELLER_NPC_IDS,
  'npc_cafe_waiter',
  'npc_corner_cup_assistant',
  'npc_clothes_seller',
  'npc_clothes_assistant',
  ...TAX_OFFICE_NPC_IDS,
] as const;
export const conversationNpcSchema = z.enum([ARRIVAL_NPC_ID, ...SHOP_NPC_IDS, ...TOWN_STREET_NPC_IDS, ...TAX_OFFICE_NPC_IDS]);
export const createConversationSchema = z.object({ npcId: conversationNpcSchema }).strict();
export const pendingOrderSchema = z.object({
  orderId: z.string().uuid(), itemId: z.string(), quantity: z.number().int().min(1).max(3),
  unitPrice: z.number().int().positive(), total: z.number().int().positive(),
}).strict();
export const sellerStateSchema = z.object({
  shop: z.enum(['cafe', 'clothes']), pendingOrder: pendingOrderSchema.nullable(), closed: z.boolean(),
}).strict();
export type PendingOrder = z.infer<typeof pendingOrderSchema>;
export type SellerState = z.infer<typeof sellerStateSchema>;
export const sendMessageSchema = z.object({
  clientMessageId: z.string().uuid(), text: z.string().trim().min(1).max(2000),
}).strict();
export const chatStreamRequestSchema = z.object({
  npcId: conversationNpcSchema,
  conversationId: z.string().uuid(),
  clientMessageId: z.string().uuid(),
  text: z.string().trim().min(1).max(300),
}).strict();
export const conversationIdSchema = z.string().uuid();
export const conversationSpeechSchema = z.object({ url: z.string().url() }).strict();
export const relationshipStageSchema = z.enum(['strained', 'stranger', 'acquaintance', 'friendly', 'friend', 'close_friend']);
export const npcRelationshipSchema = z.object({
  familiarity: z.number().int().min(0).max(100), affinity: z.number().int().min(-100).max(100),
  stage: relationshipStageSchema, reactionMood: z.enum(['upset', 'angry']).nullable(),
  reactionExpiresAt: z.string().datetime().nullable(),
}).strict();
export const conversationMessageSchema = z.object({
  id: z.string().uuid(), sender: z.enum(['player', 'npc']), text: z.string(),
  createdAt: z.string().datetime(), ai: z.literal(true).optional(), speech: conversationSpeechSchema.optional(),
}).strict();
export const turnMetadataSchema = z.object({
  intent: z.string().nullable(), misunderstood: z.boolean(), arrival: arrivalStateSchema,
  farewellStage: z.enum(['question', 'confirm']).optional(),
  seller: sellerStateSchema.optional(),
  coffeeQuest: coffeeQuestStateSchema.optional(),
  ai: z.literal(true).optional(),
  relationship: npcRelationshipSchema.optional(),
  effectiveMood: moodIdSchema.optional(),
  idCardApplication: idCardApplicationSummarySchema.optional(),
  idCardSubmit: z.literal(true).optional(),
}).strict();
export const conversationTurnSchema = turnMetadataSchema.extend({
  playerMessage: conversationMessageSchema, npcMessage: conversationMessageSchema,
}).strict();
export const conversationSchema = z.object({
  id: z.string().uuid(), npcId: conversationNpcSchema,
  messages: z.array(conversationMessageSchema), arrival: arrivalStateSchema,
  historyCursor: z.object({ npcId: conversationNpcSchema, beforeMessageId: z.string().uuid().nullable(), hasMore: z.boolean() }).strict().optional(),
  seller: sellerStateSchema.optional(),
  coffeeQuest: coffeeQuestStateSchema.optional(),
  idCardApplication: idCardApplicationSummarySchema.optional(),
}).strict();
export const conversationHistoryPageSchema = z.object({
  messages: z.array(conversationMessageSchema), hasMore: z.boolean(), beforeMessageId: z.string().uuid().nullable(),
}).strict();
export const conversationHistoryQuerySchema = z.object({ before: z.string().uuid().optional() }).strict();
export type SendMessageRequest = z.infer<typeof sendMessageSchema>;
export type ChatStreamRequest = z.infer<typeof chatStreamRequestSchema>;
export type ConversationMessage = z.infer<typeof conversationMessageSchema>;
export type TurnMetadata = z.infer<typeof turnMetadataSchema>;
export type ConversationTurn = z.infer<typeof conversationTurnSchema>;
export type Conversation = z.infer<typeof conversationSchema>;
export type ConversationHistoryPage = z.infer<typeof conversationHistoryPageSchema>;
export type NpcRelationship = z.infer<typeof npcRelationshipSchema>;
