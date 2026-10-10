import grammar from './content/grammar.common.json';
import common from './content/intents.common.json';
import { splitGreeting } from './questions';

export interface IntentMatch { id: string; slots: Readonly<Record<string, string>> }
export interface IntentDefinition { id: string; pattern: string; slot?: string; entities?: Readonly<Record<string, readonly string[] | undefined>> }
export interface GrammarFeedback { original: string; improved: string; reason: string; question: string }
export function normalizeDialogue(input: string): string { return input.trim().replace(/[’]/g, "'").replace(/\s+/g, ' '); }

export function detectIntent(input: string, confirmation = false, domainIntents: readonly IntentDefinition[] = []): IntentMatch | undefined {
  const normalized = normalizeDialogue(input);
  const { greeting: hasGreeting, body } = splitGreeting(normalized);
  const text = hasGreeting ? body : normalized;
  if (!text && hasGreeting) return { id: 'greet', slots: {} };
  for (const rule of common.intents) {
    if (rule.id === 'greet') continue;
    if (rule.id === 'confirm' && !confirmation) continue;
    if (new RegExp(rule.pattern, 'i').test(text)) return { id: rule.id, slots: {} };
  }
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
