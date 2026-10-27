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
  prompts: z.object({
    name: authoredText,
    dateOfBirth: authoredText,
    address: authoredText,
    origin: authoredText,
    photo: authoredText,
    review: authoredText,
    correction: authoredText,
  }).strict(),
  reviewTemplate: authoredText,
  retries: z.object({
    name: authoredText,
    dateOfBirth: authoredText,
    address: authoredText,
    origin: authoredText,
    correction: authoredText,
  }).strict(),
  cancelled: authoredText,
}).strict();

export type IdCardApplicationField = z.infer<typeof idCardApplicationFieldSchema>;
export type IdCardApplicationContent = z.infer<typeof idCardApplicationContentSchema>;

export const idCardApplicationSummarySchema = z.object({
  step: z.enum(['photo', 'review']),
  name: z.string().min(1).max(60),
  dateOfBirth: z.string().date(),
  address: z.string().min(1).max(120).nullable(),
  gender: z.enum(['male', 'female']),
  origin: z.string().min(1).max(60),
}).strict();

export const issueIdCardBodySchema = z.object({
  conversationId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
}).strict();

export const idCardIssueResponseSchema = z.object({
  issued: z.literal(true),
  photoUrl: z.string().url().nullable(),
}).strict();

export type IdCardApplicationSummary = z.infer<typeof idCardApplicationSummarySchema>;
export type IssueIdCardBody = z.infer<typeof issueIdCardBodySchema>;
export type IdCardIssueResponse = z.infer<typeof idCardIssueResponseSchema>;

export function isIdCardConfirmation(input: string): boolean {
  const normalized = input.trim().toLowerCase().replace(/[’]/g, "'")
    .replace(/[^a-z0-9']+/g, ' ').trim();
  return ['yes', 'yes please', 'yes issue my card', 'correct', 'that is correct'].includes(normalized);
}

