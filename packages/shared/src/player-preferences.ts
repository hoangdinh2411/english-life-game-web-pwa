import { z } from 'zod';

const preferenceFields = {
  coachEnabled: z.boolean(),
  speechRate: z.number().finite().min(0.75).max(1.5),
  speechPitch: z.number().finite().min(0.75).max(1.25),
} as const;

export const DEFAULT_PLAYER_PREFERENCES = {
  coachEnabled: false,
  speechRate: 1,
  speechPitch: 1,
} as const;

export const playerPreferencesSchema = z.object({
  ...preferenceFields,
  updatedAt: z.string().datetime(),
}).strict();

export const playerPreferencesReadSchema = z.object({
  preferences: playerPreferencesSchema.nullable(),
}).strict();

export const playerPreferencesInitializeSchema = z.object(preferenceFields).strict();

export const playerPreferencesUpdateSchema = z.object({
  coachEnabled: preferenceFields.coachEnabled.optional(),
  speechRate: preferenceFields.speechRate.optional(),
  speechPitch: preferenceFields.speechPitch.optional(),
}).strict().refine(value => Object.keys(value).length > 0, 'Select at least one preference');

export type PlayerPreferences = z.infer<typeof playerPreferencesSchema>;
export type PlayerPreferencesRead = z.infer<typeof playerPreferencesReadSchema>;
export type PlayerPreferencesInitialize = z.infer<typeof playerPreferencesInitializeSchema>;
export type PlayerPreferencesUpdate = z.infer<typeof playerPreferencesUpdateSchema>;
