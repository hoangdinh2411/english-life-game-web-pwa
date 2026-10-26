import { z } from 'zod';

const authoredText = z.string().trim().min(1);

export const idCardApplicationFieldSchema = z.enum([
  'name', 'dateOfBirth', 'address', 'gender', 'origin', 'photo', 'review', 'correction',
]);

export const idCardApplicationContentSchema = z.object({
  version: z.literal(1),
  registrationPhrases: z.array(authoredText).min(1),
  cancellationPhrases: z.array(authoredText).min(1),
  addressNullPhrases: z.array(authoredText).min(1),
  prompts: z.record(idCardApplicationFieldSchema, authoredText),
  reviewTemplate: authoredText,
  retries: z.object({
    name: authoredText,
    dateOfBirth: authoredText,
    address: authoredText,
    gender: authoredText,
    origin: authoredText,
    correction: authoredText,
  }).strict(),
  cancelled: authoredText,
}).strict();

export type IdCardApplicationField = z.infer<typeof idCardApplicationFieldSchema>;
export type IdCardApplicationContent = z.infer<typeof idCardApplicationContentSchema>;

