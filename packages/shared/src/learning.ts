import { z } from 'zod';
import { turnMetadataSchema } from './conversations';

export const learningMetadataSchema = z.object({ intent: z.string().nullable().optional(),
  correction: turnMetadataSchema.shape.correction.optional() });

export const reviewSchema = z.object({
  phrases: z.array(z.object({ phrase: z.string(), example: z.string() }).strict()).max(10),
  corrections: z.array(z.object({
    id: z.string().uuid(), createdAt: z.string().datetime(),
    feedback: turnMetadataSchema.shape.correction.unwrap(),
  }).strict()).max(20),
}).strict();
export type LearningReview = z.infer<typeof reviewSchema>;
