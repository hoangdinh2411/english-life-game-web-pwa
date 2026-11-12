import { z } from 'zod';

// Contract for the shared contextual intent layer (T40). Intent names describe
// language only; a domain handler alone decides what an accepted intent does.
export const CONTEXT_INTENT_IDS = ['confirm', 'deny', 'cancel', 'unknown', 'not_available', 'provide_later'] as const;
export const contextIntentIdSchema = z.enum(CONTEXT_INTENT_IDS);
export type ContextIntentId = z.infer<typeof contextIntentIdSchema>;

export const unclearReasonSchema = z.enum(['no_match', 'ambiguous', 'conflicting']);
export type UnclearReason = z.infer<typeof unclearReasonSchema>;

const matchedResultSchema = z.object({
  status: z.literal('matched'),
  primary: contextIntentIdSchema,
  modifiers: z.array(contextIntentIdSchema),
}).strict().superRefine((result, context) => {
  if (new Set(result.modifiers).size !== result.modifiers.length) {
    context.addIssue({ code: 'custom', path: ['modifiers'], message: 'Modifiers must be unique' });
  }
  if (result.modifiers.includes(result.primary)) {
    context.addIssue({ code: 'custom', path: ['modifiers'], message: 'A modifier must differ from the primary intent' });
  }
});

const unclearResultSchema = z.object({
  status: z.literal('unclear'),
  reason: unclearReasonSchema,
}).strict();

export const intentResultSchema = z.discriminatedUnion('status', [matchedResultSchema, unclearResultSchema]);
export type IntentResult = z.infer<typeof intentResultSchema>;

const identifier = z.string().regex(/^[a-z][a-z0-9_]*$/, 'Use lowercase letters, digits and underscores');
const authoredWord = z.string().trim().min(1);

// Data-only description of what a question or state may accept. It holds no
// code, regex or state; the shared detector only reads it.
export const contextProfileSchema = z.object({
  id: identifier,
  allowedIntents: z.array(contextIntentIdSchema).min(1),
  // A bare word read in this context, e.g. "no" → deny (yes/no question) or
  // not_available (field question). Targets must be allowed intents.
  bareWords: z.record(authoredWord, contextIntentIdSchema).optional(),
  // Topic name → words that mean it, e.g. address → ["address", "home"].
  topicAliases: z.record(identifier, z.array(authoredWord).min(1)).optional(),
  // AI classification is opt-in per profile and off unless a domain says so.
  aiFallback: z.boolean().default(false),
}).strict().superRefine((profile, context) => {
  if (new Set(profile.allowedIntents).size !== profile.allowedIntents.length) {
    context.addIssue({ code: 'custom', path: ['allowedIntents'], message: 'Allowed intents must be unique' });
  }
  for (const [word, intent] of Object.entries(profile.bareWords ?? {})) {
    if (!profile.allowedIntents.includes(intent)) {
      context.addIssue({ code: 'custom', path: ['bareWords', word], message: `Bare word reading "${intent}" is not an allowed intent` });
    }
  }
});

export type ContextProfile = z.infer<typeof contextProfileSchema>;
export type ContextProfileInput = z.input<typeof contextProfileSchema>;

export function defineContextProfile(input: ContextProfileInput): ContextProfile {
  return contextProfileSchema.parse(input);
}

export function parseIntentResult(input: unknown): IntentResult {
  return intentResultSchema.parse(input);
}
