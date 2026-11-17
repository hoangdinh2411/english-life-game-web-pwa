import { z } from 'zod';

export const USER_MODES = ['kid', 'adult'] as const;
export const userModeSchema = z.enum(USER_MODES);
export type UserMode = z.infer<typeof userModeSchema>;

const preferenceFields = {
  speechRate: z.number().finite().min(0.75).max(1.5),
  speechPitch: z.number().finite().min(0.75).max(1.25),
  userMode: userModeSchema.default('adult'),
} as const;

export const DEFAULT_PLAYER_PREFERENCES = {
  speechRate: 1,
  speechPitch: 1,
  userMode: 'adult' as const,
} as const;

export const playerPreferencesSchema = z.object({
  speechRate: preferenceFields.speechRate,
  speechPitch: preferenceFields.speechPitch,
  userMode: userModeSchema,
  updatedAt: z.string().datetime(),
}).strict();

export const playerPreferencesReadSchema = z.object({
  preferences: playerPreferencesSchema.nullable(),
}).strict();

export const playerPreferencesInitializeSchema = z.object({
  speechRate: preferenceFields.speechRate,
  speechPitch: preferenceFields.speechPitch,
  userMode: userModeSchema.default('adult'),
}).strict();

export const playerPreferencesUpdateSchema = z.object({
  speechRate: preferenceFields.speechRate.optional(),
  speechPitch: preferenceFields.speechPitch.optional(),
  userMode: userModeSchema.optional(),
}).strict().refine(value => Object.keys(value).length > 0, 'Select at least one preference');

export type PlayerPreferences = z.infer<typeof playerPreferencesSchema>;
export type PlayerPreferencesRead = z.infer<typeof playerPreferencesReadSchema>;
export type PlayerPreferencesInitialize = z.input<typeof playerPreferencesInitializeSchema>;
export type PlayerPreferencesUpdate = z.infer<typeof playerPreferencesUpdateSchema>;
