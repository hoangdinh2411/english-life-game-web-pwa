import grammar from './content/grammar.common.json';
import { defineContextProfile } from './intent-contract';
import { detectContextIntent } from './intent-detector';
import { splitGreeting } from './questions';

export interface IntentMatch { id: string; slots: Readonly<Record<string, string>> }
export interface IntentDefinition { id: string; pattern: string; slot?: string; entities?: Readonly<Record<string, readonly string[] | undefined>> }
export interface GrammarFeedback { original: string; improved: string; reason: string; question: string }
export function normalizeDialogue(input: string): string { return input.trim().replace(/[’]/g, "'").replace(/\s+/g, ' '); }

export const FAREWELL_PROFILE = defineContextProfile({
  id: 'farewell',
  allowedIntents: ['goodbye', 'thank', 'confirm', 'deny'],
});

export const SOCIAL_INTENT_PROFILE = defineContextProfile({
  id: 'social_intent',
  allowedIntents: ['greet', 'thank', 'goodbye'],
});

export const FAREWELL_CLOSING_PROFILE = defineContextProfile({
  id: 'farewell_closing',
  allowedIntents: ['confirm', 'deny'],
});

export const SERVICE_CONTINUATION_PROFILE = defineContextProfile({
  id: 'service_continuation',
  allowedIntents: ['confirm', 'deny', 'cancel', 'not_available', 'thank', 'goodbye'],
  bareWords: { 'all good': 'deny', nope: 'confirm' },
});

export function endsWithFarewell(input: string): boolean {
  const finalSentence = normalizeDialogue(input).split(/[.!?]\s+/).at(-1)?.replace(/:+$/, '').trim() ?? '';
  const decision = detectContextIntent(finalSentence, FAREWELL_PROFILE);
  return decision.status === 'matched' && (decision.primary === 'goodbye' || decision.modifiers.includes('goodbye'));
}

export function farewellClosing(input: string): string {
  const decision = detectContextIntent(input, FAREWELL_CLOSING_PROFILE);
  if (decision.status === 'matched' && decision.modifiers.every((modifier) => modifier === 'thank')) {
    if (decision.primary === 'confirm') {
      return 'That would be lovely. I hope to see you tomorrow. Goodbye!';
    }
    if (decision.primary === 'deny') {
      return 'I understand. It was nice talking with you. Goodbye!';
    }
  }
  return 'I hope to see you again. It was nice talking with you. Goodbye!';
}

export function serviceContinuationIntent(input: string): 'continue' | 'finish' | 'unclear' {
  const normalized = normalizeDialogue(input).toLowerCase().replace(/[.!?,]+$/g, '').trim();
  if (!normalized) return 'unclear';
  const hasNewRequest = /\b(?:i|we) (?:also )?(?:need|want|would like|have to)\b/.test(normalized)
    && !/\b(?:i|we) (?:do not|don't|dont|no longer) (?:need|want|have to)\b/.test(normalized);
  if (hasNewRequest) return 'continue';
  const decision = detectContextIntent(normalized, SERVICE_CONTINUATION_PROFILE);
  if (decision.status === 'matched' && decision.modifiers.every((modifier) => modifier === 'thank' || modifier === 'goodbye')) {
    return decision.primary === 'confirm' ? 'continue' : 'finish';
  }
  return 'continue';
}

// Domain-specific station entity/topic extraction only; reusable language intents use detectContextIntent.
export function detectIntent(input: string, domainIntents: readonly IntentDefinition[] = []): IntentMatch | undefined {
  if (domainIntents.length === 0) return undefined;
  const normalized = normalizeDialogue(input);
  const { greeting: hasGreeting, body } = splitGreeting(normalized);
  const text = hasGreeting ? body : normalized;
  if (!text) return undefined;
  for (const rule of domainIntents) {
    if (!new RegExp(rule.pattern, 'i').test(text)) continue;
    if (!rule.entities || !rule.slot) return { id: rule.id, slots: {} };
    for (const [entity, aliases] of Object.entries(rule.entities)) {
      if (aliases?.some((alias) => new RegExp(`\\b${alias}\\b`, 'i').test(text))) return { id: rule.id, slots: { [rule.slot]: entity } };
    }
  }
  return undefined;
}

export function checkGrammar(input: string): GrammarFeedback | undefined {
  const original = input.trim();
  const phrase = normalizeDialogue(input).replace(/^(?:hello|hi|hey)[!,.]?\s+/i, '').replace(/[.!?]+$/, '').trim();
  // Avoid guessing corrections for reported speech, negation, or compound meanings.
  if (!/^(?:I (?:need|want|new)|My journey)\b/i.test(phrase) || /\b(?:not|don't|and|but|or)\b/i.test(phrase)) return undefined;
  let improved = phrase;
  const reasons: string[] = [];
  for (const rule of grammar.rules) {
    const next = improved.replace(new RegExp(rule.pattern, 'i'), rule.replacement);
    if (next !== improved) { improved = next; reasons.push(rule.reason); }
  }
  if (!reasons.length) return undefined;
  improved = improved.replace(/^i\b/i, 'I').replace(/^my\b/i, 'My').replace(/\bid card\b/gi, 'ID card');
  const question = improved.replace(/^I am\b/i, 'You are').replace(/^I\b/i, 'You').replace(/^My\b/i, 'Your');
  return { original, improved: `${improved}.`, reason: reasons.join(' '), question: question.charAt(0).toLowerCase() + question.slice(1) };
}
