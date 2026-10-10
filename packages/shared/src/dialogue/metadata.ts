import { z } from 'zod';

const tag = z.string().trim().regex(/^[a-z][a-z0-9_]*$/);
const tags = z.array(tag).refine((values) => new Set(values).size === values.length, 'Tags must be unique');

export const dialogueContextSchema = z.object({
  topic: tag.optional(),
  timeReference: z.enum(['past', 'completed_past', 'present', 'future', 'unspecified']).optional(),
  expectedIntents: tags.optional(),
}).strict();

// Parse only metadata so both authored quest nodes and local practice nodes can use it.
export const dialogueMetadataSchema = z.object({
  context: dialogueContextSchema.optional(),
  learningFocus: tags.optional(),
});

export type DialogueContext = z.infer<typeof dialogueContextSchema>;
export type DialogueMetadata = z.infer<typeof dialogueMetadataSchema>;
export const practiceDialogueNodeSchema = dialogueMetadataSchema.extend({ text: z.string().min(1) }).strict();
export type PracticeDialogueNode = z.infer<typeof practiceDialogueNodeSchema>;
