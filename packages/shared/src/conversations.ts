import { z } from 'zod';
import { ARRIVAL_NPC_ID, arrivalStateSchema } from './quests';

export const createConversationSchema = z.object({ npcId: z.literal(ARRIVAL_NPC_ID) }).strict();
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
}).strict();
export const conversationTurnSchema = turnMetadataSchema.extend({
  playerMessage: conversationMessageSchema, npcMessage: conversationMessageSchema,
}).strict();
export const conversationSchema = z.object({
  id: z.string().uuid(), npcId: z.literal(ARRIVAL_NPC_ID),
  messages: z.array(conversationMessageSchema), arrival: arrivalStateSchema,
}).strict();
export type SendMessageRequest = z.infer<typeof sendMessageSchema>;
export type ConversationMessage = z.infer<typeof conversationMessageSchema>;
export type TurnMetadata = z.infer<typeof turnMetadataSchema>;
export type ConversationTurn = z.infer<typeof conversationTurnSchema>;
export type Conversation = z.infer<typeof conversationSchema>;
