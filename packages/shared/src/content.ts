import { z } from 'zod';
import { dialogueMetadataSchema } from './dialogue/metadata';

const identifier = z.string().regex(/^[a-z][a-z0-9_]*$/);
const text = z.string().refine((value) => value.trim().length > 0, 'Text must not be blank');
const level = z.enum(['A1', 'A2', 'B1', 'B2', 'C1']);

export const townSeedSchema = z.object({
  id: identifier,
  isStarterCity: z.literal(true),
  name: text,
  description: text,
  locations: z.array(z.object({ id: identifier, name: text, type: identifier }).strict())
    .min(1).refine(uniqueIds, 'Location IDs must be unique'),
}).strict();

function uniqueIds<T extends { id: string }>(values: T[]): boolean {
  return new Set(values.map(({ id }) => id)).size === values.length;
}

export const npcSchema = z.object({
  id: identifier,
  name: text,
  role: identifier,
  personality: identifier,
  speakingLevel: level,
  locationId: identifier,
  bio: text,
}).strict();

export const questStepSchema = z.object({
  id: identifier,
  description: text,
  doneWhen: z.object({ intent: identifier }).strict(),
}).strict();

export const questSchema = z.object({
  id: identifier,
  title: text,
  requiredLevel: level,
  npcId: identifier,
  rewards: z.object({ xp: z.number().int().nonnegative(), coins: z.number().int().nonnegative() }).strict(),
  steps: z.array(questStepSchema).min(1).refine(uniqueIds, 'Step IDs must be unique within a quest'),
}).strict();

export const dialogueNodeSchema = dialogueMetadataSchema.extend({
  id: identifier,
  text: z.object({ default: text }).catchall(text),
  intents: z.array(z.object({
    name: identifier,
    keywords: z.array(text).min(1),
    next: identifier,
  }).strict()).optional(),
  fallback: identifier.optional(),
  completesStep: identifier.optional(),
  end: z.boolean().optional(),
}).strict();

const dialogueFields = {
  version: z.number().int().positive(),
  nodes: z.array(dialogueNodeSchema).min(1).refine(uniqueIds, 'Node IDs must be unique within a file'),
};

// Scope determines which reference is required; global files have neither.
export const dialogueSchema = z.discriminatedUnion('scope', [
  z.object({ ...dialogueFields, scope: z.literal('global') }).strict(),
  z.object({ ...dialogueFields, scope: z.literal('role'), role: identifier }).strict(),
  z.object({ ...dialogueFields, scope: z.literal('npc'), npcId: identifier }).strict(),
]);

export const npcCatalogSchema = z.array(npcSchema).min(1).refine(uniqueIds, 'NPC IDs must be unique');
export const questCatalogSchema = z.array(questSchema).min(1).refine(uniqueIds, 'Quest IDs must be unique');

export type NpcContent = z.infer<typeof npcSchema>;
export type QuestContent = z.infer<typeof questSchema>;
export type DialogueContent = z.infer<typeof dialogueSchema>;
