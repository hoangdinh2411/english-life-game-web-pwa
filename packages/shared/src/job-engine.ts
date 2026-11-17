import { z } from 'zod';
import { userModeSchema } from './player-preferences';

export const JOB_INDUSTRIES = [
  'hospitality_fb',
  'retail_commerce',
  'logistics_transport',
  'office_admin',
  'healthcare_public',
  'craft_repair',
] as const;
export const jobIndustrySchema = z.enum(JOB_INDUSTRIES);
export type JobIndustry = z.infer<typeof jobIndustrySchema>;

export const JOB_ARCHETYPES = [
  'assembly',
  'sorting',
  'matching',
  'timing',
] as const;
export const jobArchetypeSchema = z.enum(JOB_ARCHETYPES);
export type JobArchetype = z.infer<typeof jobArchetypeSchema>;

export const jobDefinitionSchema = z.object({
  id: z.string().regex(/^job_[a-z0-9_]+$/),
  industry: jobIndustrySchema,
  archetype: jobArchetypeSchema,
  title: z.string().min(1),
  stationName: z.string().min(1),
  description: z.string(),
  supportedModes: z.array(userModeSchema).min(1),
}).strict();
export type JobDefinition = z.infer<typeof jobDefinitionSchema>;

export const jobOrderItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  icon: z.string().optional(),
  quantity: z.number().int().positive().default(1),
}).strict();
export type JobOrderItem = z.infer<typeof jobOrderItemSchema>;

export const sortingBinSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  accepts: z.array(z.string().min(1)),
}).strict();
export type SortingBin = z.infer<typeof sortingBinSchema>;

export const jobTicketSchema = z.object({
  ticketId: z.string().min(1),
  jobId: z.string().regex(/^job_[a-z0-9_]+$/),
  customerName: z.string().min(1),
  orderPromptEnglish: z.string().min(1),
  targetSequence: z.array(z.string().min(1)).optional(),
  sortingBins: z.array(sortingBinSchema).optional(),
  matchingCriteria: z.record(z.string(), z.string()).optional(),
  exclusions: z.array(z.string().min(1)).optional(),
  distractorPool: z.array(z.string().min(1)).optional(),
  timeLimitSeconds: z.number().int().positive().optional(),
  rewardCoins: z.number().int().nonnegative().default(10),
  rewardXp: z.number().int().nonnegative().default(15),
}).strict();
export type JobTicket = z.infer<typeof jobTicketSchema>;

export const jobMistakeDetailSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  educationalNote: z.string().optional(),
}).strict();
export type JobMistakeDetail = z.infer<typeof jobMistakeDetailSchema>;

export const jobShiftReportSchema = z.object({
  ticketId: z.string().min(1),
  jobId: z.string().regex(/^job_[a-z0-9_]+$/),
  idempotencyKey: z.string().uuid(),
  score: z.number().min(0).max(100),
  stars: z.number().int().min(0).max(3),
  accuracyPercent: z.number().min(0).max(100),
  mistakes: z.array(jobMistakeDetailSchema),
  timeElapsedSeconds: z.number().nonnegative(),
  completedAt: z.string().datetime(),
}).strict();
export type JobShiftReport = z.infer<typeof jobShiftReportSchema>;

export function calculateJobStars(score: number): number {
  if (score >= 90) return 3;
  if (score >= 60) return 2;
  if (score >= 30) return 1;
  return 0;
}
