import { z } from 'zod';
import { defineContextProfile } from './dialogue/intent-contract';

const authoredText = z.string().trim().min(1);

export const idCardApplicationFieldSchema = z.enum([
  'name', 'dateOfBirth', 'address', 'gender', 'origin', 'photo', 'review', 'correction',
]);

export const idCardApplicationContentSchema = z.object({
  version: z.literal(1),
  registrationPhrases: z.array(authoredText).min(1),
  prompts: z.object({
    name: authoredText,
    dateOfBirth: authoredText,
    address: authoredText,
    addressNotProvided: authoredText,
    origin: authoredText,
    photo: authoredText,
    review: authoredText,
    correction: authoredText,
    issued: authoredText,
    updated: authoredText,
    updating: authoredText,
    alreadyIssued: authoredText,
    existing: authoredText,
  }).strict(),
  correctionPrompts: z.object({
    name: authoredText,
    dateOfBirth: authoredText,
    address: authoredText,
    origin: authoredText,
    photo: authoredText,
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
  mode: z.enum(['create', 'edit']),
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
  npcMessage: z.object({
    id: z.string().uuid(), sender: z.literal('npc'), text: z.string(), createdAt: z.string().datetime(),
    speech: z.object({ url: z.string().url() }).strict().optional(),
  }).strict(),
}).strict();

export const idCardResponseSchema = z.object({
  number: z.string().regex(/^\d{8}-\d{4}$/),
  fullName: z.string().min(1).max(60),
  birthDate: z.string().date(),
  address: z.string().min(1).max(120).nullable(),
  gender: z.enum(['male', 'female']),
  origin: z.string().min(1).max(60),
  photoUrl: z.string().url().nullable(),
  issuedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict();

export type IdCardApplicationSummary = z.infer<typeof idCardApplicationSummarySchema>;
export type IssueIdCardBody = z.infer<typeof issueIdCardBodySchema>;
export type IdCardIssueResponse = z.infer<typeof idCardIssueResponseSchema>;
export type IdCardResponse = z.infer<typeof idCardResponseSchema>;

// Data-only state profiles for the ID-card application flow (T40.c).
export const ID_CARD_REVIEW_PROFILE = defineContextProfile({
  id: 'id_card_review', allowedIntents: ['confirm', 'deny', 'cancel', 'provide_later'],
});
export const ID_CARD_ADDRESS_PROFILE = defineContextProfile({
  id: 'id_card_address', allowedIntents: ['cancel', 'not_available', 'unknown', 'provide_later'],
  bareWords: { no: 'not_available' },
});
export const ID_CARD_FIELD_PROFILE = defineContextProfile({ id: 'id_card_field', allowedIntents: ['cancel'] });
