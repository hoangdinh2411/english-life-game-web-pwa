import { z } from 'zod';
import { conversationNpcSchema } from './conversations';

export const npcPresenceQuerySchema = z.object({
  mapId: z.string().regex(/^[a-z][a-z0-9_]*$/),
}).strict();

export const npcPresenceResponseSchema = z.object({
  mapId: z.string(),
  gameTime: z.string().datetime(),
  timeZone: z.string(),
  presentNpcIds: z.array(conversationNpcSchema),
  nextChangeAt: z.string().datetime().nullable(),
}).strict();

export type NpcPresenceResponse = z.infer<typeof npcPresenceResponseSchema>;
