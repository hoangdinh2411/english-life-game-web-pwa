import { z } from 'zod';
import { ARRIVAL_NPC_ID, arrivalStateSchema } from './quests';

export const SELLER_NPC_ID = 'npc_mia';
export const SHOP_NPC_IDS = ['npc_mia', 'npc_cafe_waiter', 'npc_cafe_customer', 'npc_clothes_seller', 'npc_clothes_assistant', 'npc_clothes_customer'] as const;
export const conversationNpcSchema = z.enum([ARRIVAL_NPC_ID, ...SHOP_NPC_IDS]);
export const createConversationSchema = z.object({ npcId: conversationNpcSchema }).strict();
export const pendingOrderSchema = z.object({
  orderId: z.string().uuid(), itemId: z.string(), quantity: z.number().int().min(1).max(3),
  unitPrice: z.number().int().positive(), total: z.number().int().positive(),
}).strict();
export const sellerStateSchema = z.object({
  shop: z.literal('cafe'), pendingOrder: pendingOrderSchema.nullable(), closed: z.boolean(),
}).strict();
export type PendingOrder = z.infer<typeof pendingOrderSchema>;
export type SellerState = z.infer<typeof sellerStateSchema>;
export const sendMessageSchema = z.object({
  clientMessageId: z.string().uuid(), text: z.string().trim().min(1).max(2000),
  coach: z.boolean().default(false),
}).strict();
export const conversationIdSchema = z.string().uuid();
export const conversationMessageSchema = z.object({
  id: z.string().uuid(), sender: z.enum(['player', 'npc']), text: z.string(),
  createdAt: z.string().datetime(),
}).strict();
export const turnMetadataSchema = z.object({
  intent: z.string().nullable(), misunderstood: z.boolean(), arrival: arrivalStateSchema,
  correction: z.object({ original: z.string(), improved: z.string(), reason: z.string(), question: z.string() }).strict().nullable(),
  seller: sellerStateSchema.optional(),
}).strict();
export const conversationTurnSchema = turnMetadataSchema.extend({
  playerMessage: conversationMessageSchema, npcMessage: conversationMessageSchema,
}).strict();
export const conversationSchema = z.object({
  id: z.string().uuid(), npcId: conversationNpcSchema,
  messages: z.array(conversationMessageSchema), arrival: arrivalStateSchema,
  seller: sellerStateSchema.optional(),
}).strict();
export type SendMessageRequest = z.infer<typeof sendMessageSchema>;
export type ConversationMessage = z.infer<typeof conversationMessageSchema>;
export type TurnMetadata = z.infer<typeof turnMetadataSchema>;
export type ConversationTurn = z.infer<typeof conversationTurnSchema>;
export type Conversation = z.infer<typeof conversationSchema>;
