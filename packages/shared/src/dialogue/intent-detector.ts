import { z } from 'zod';
import lexiconJson from './content/intent-lexicon.json';
import {
  contextIntentIdSchema, contextProfileSchema,
  type ContextIntentId, type ContextProfile, type ContextProfileInput, type IntentResult,
} from './intent-contract';

// Shared deterministic intent detector (T40.b). Pure: no I/O, no state. It reads an
// authored lexicon (phrase DSL) and a data-only ContextProfile; it never decides
// what an intent does — the domain handler owns every transition.
//
// Phrase DSL (validated by `pnpm content:validate`):
//   word          lowercase letters/digits, e.g. `cancel`
//   (a b)         optional part, e.g. `(please)`; `(a|b)` is an optional choice
//   a|b           required choice between single words
//   {topic}       any topic alias; `{address}` one named topic from the lexicon
// Politeness, determiners and time phrases live in `fillers`, so phrases never repeat them.

const MAX_EXPANSIONS = 256;
const WORD = /^[a-z0-9]+$/;
const PLACEHOLDER = /^\{([a-z_]+)\}$/;

const phraseSchema = z.object({
  intent: contextIntentIdSchema,
  // literal: match the clause as written; negated: clause must contain a negation, which is removed first.
  mode: z.enum(['literal', 'negated']),
  patterns: z.array(z.string().trim().min(1)).min(1),
}).strict();

export const intentLexiconSchema = z.object({
  fillers: z.array(z.string().trim().min(1)).min(1),
  negations: z.array(z.string().trim().min(1)).min(1),
  negationAuxiliaries: z.array(z.string().trim().min(1)),
  clauseSeparators: z.array(z.string().trim().min(1)).min(1),
  contractions: z.record(z.string().min(1), z.string().min(1)),
  topics: z.record(z.string().regex(/^[a-z_]+$/), z.array(z.string().trim().min(1)).min(1)),
  compatible: z.array(z.tuple([contextIntentIdSchema, contextIntentIdSchema])),
  phrases: z.array(phraseSchema).min(1),
}).strict();

export type IntentLexicon = z.infer<typeof intentLexiconSchema>;

type Template = readonly string[]; // words and `{name}` placeholders

interface CompiledPhrase { readonly intent: ContextIntentId; readonly mode: 'literal' | 'negated'; readonly template: Template }

export interface CompiledIntentLexicon {
  readonly source: IntentLexicon;
  readonly fillers: readonly Template[]; // longest first
  readonly negations: ReadonlySet<string>;
  readonly auxiliaries: ReadonlySet<string>;
  readonly separators: ReadonlySet<string>;
  readonly phrases: readonly CompiledPhrase[];
}

function words(text: string): string[] {
  return text.toLowerCase().replace(/[’‘]/g, "'").match(/[a-z0-9']+/g) ?? [];
}

// Splits a DSL pattern into top-level parts, keeping `( ... )` groups whole.
function splitParts(pattern: string): string[] | undefined {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of pattern) {
    if (char === '(') {
      if (depth > 0) return undefined;
      depth += 1;
    } else if (char === ')') {
      if (depth === 0) return undefined;
      depth -= 1;
    }
    if (/\s/.test(char) && depth === 0) {
      if (current) parts.push(current);
      current = '';
    } else current += char;
  }
  if (depth !== 0) return undefined;
  if (current) parts.push(current);
  return parts;
}

function validToken(token: string): boolean {
  return WORD.test(token) || PLACEHOLDER.test(token);
}

// Returns the expanded templates, or an error message.
function expandPattern(pattern: string): { templates: Template[] } | { error: string } {
  const parts = splitParts(pattern);
  if (!parts || parts.length === 0) return { error: 'unbalanced parentheses' };
  let templates: string[][] = [[]];
  let required = 0;
  for (const part of parts) {
    const optional = part.startsWith('(') && part.endsWith(')');
    const body = optional ? part.slice(1, -1) : part;
    if (body.length === 0) return { error: 'empty group' };
    const choices: string[][] = [];
    for (const alternative of body.split('|')) {
      const tokens = alternative.trim().split(/\s+/).filter(Boolean);
      if (tokens.length === 0) return { error: 'empty alternative' };
      for (const token of tokens) if (!validToken(token)) return { error: `invalid token "${token}"` };
      choices.push(tokens);
    }
    if (optional) choices.push([]); else required += 1;
    templates = templates.flatMap((prefix) => choices.map((choice) => [...prefix, ...choice]));
    if (templates.length > MAX_EXPANSIONS) return { error: `expands to more than ${MAX_EXPANSIONS} phrases` };
  }
  if (required === 0 && !parts.some((part) => !part.startsWith('('))) return { error: 'phrase has no required word' };
  return { templates: [...new Map(templates.filter((t) => t.length > 0).map((t) => [t.join(' '), t])).values()] };
}

export function compileIntentLexicon(raw: unknown): CompiledIntentLexicon {
  const parsed = intentLexiconSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`).join('\n'));
  }
  const lexicon = parsed.data;
  const errors: string[] = [];
  const fillers = lexicon.fillers.map((filler) => words(filler)).filter((tokens) => tokens.length > 0);
  const singleFillers = new Set(fillers.filter((tokens) => tokens.length === 1).map((tokens) => tokens[0]));
  const negations = new Set(lexicon.negations.map((word) => word.toLowerCase()));
  const seen = new Map<string, string>();
  const phrases: CompiledPhrase[] = [];
  const topicNames = new Set(Object.keys(lexicon.topics));

  for (const [name, aliases] of Object.entries(lexicon.topics)) {
    if (name === 'topic') errors.push('topics: "topic" is reserved for the any-topic placeholder');
    for (const alias of aliases) if (words(alias).length === 0) errors.push(`topics.${name}: empty alias`);
  }
  if (new Set(fillers.map((tokens) => tokens.join(' '))).size !== fillers.length) errors.push('fillers: duplicate filler');

  lexicon.phrases.forEach((entry, entryIndex) => {
    entry.patterns.forEach((pattern, patternIndex) => {
      const where = `phrases.${entryIndex}.patterns.${patternIndex} (${entry.intent}) "${pattern}"`;
      const expanded = expandPattern(pattern);
      if ('error' in expanded) {
        errors.push(`${where}: ${expanded.error}`);
        return;
      }
      for (const template of expanded.templates) {
        for (const token of template) {
          const placeholder = PLACEHOLDER.exec(token)?.[1];
          if (placeholder && placeholder !== 'topic' && !topicNames.has(placeholder)) errors.push(`${where}: unknown topic {${placeholder}}`);
          if (!placeholder && singleFillers.has(token)) errors.push(`${where}: "${token}" is a filler and can never match; remove it`);
          if (!placeholder && entry.mode === 'negated' && negations.has(token)) errors.push(`${where}: negated phrases must not contain the negation "${token}"`);
        }
        const key = `${entry.mode}:${template.join(' ')}`;
        const earlier = seen.get(key);
        if (earlier) errors.push(`${where}: duplicate phrase "${template.join(' ')}" (also ${earlier})`);
        else seen.set(key, `${entry.intent}`);
        phrases.push({ intent: entry.intent, mode: entry.mode, template });
      }
    });
  });
  if (errors.length > 0) throw new Error([...new Set(errors)].join('\n'));

  return {
    source: lexicon,
    fillers: [...fillers].sort((a, b) => b.length - a.length),
    negations,
    auxiliaries: new Set(lexicon.negationAuxiliaries.map((word) => word.toLowerCase())),
    separators: new Set(lexicon.clauseSeparators.map((word) => word.toLowerCase())),
    phrases,
  };
}

export const DEFAULT_INTENT_LEXICON: CompiledIntentLexicon = compileIntentLexicon(lexiconJson);

// ---------- detection ----------

function expandWord(word: string, lexicon: CompiledIntentLexicon): string[] {
  const mapped = lexicon.source.contractions[word];
  if (mapped) return mapped.split(' ');
  if (!word.includes("'")) return [word];
  if (word.endsWith("n't")) return [word.slice(0, -3), 'not'];
  if (word.endsWith("'ll")) return [word.slice(0, -3), 'will'];
  if (word.endsWith("'m")) return [word.slice(0, -2), 'am'];
  if (word.endsWith("'ve")) return [word.slice(0, -3), 'have'];
  if (word.endsWith("'re")) return [word.slice(0, -3), 'are'];
  if (word.endsWith("'s")) return [word.slice(0, -2), 'is'];
  return [word.replace(/'/g, '')];
}

function stripFillers(tokens: readonly string[], lexicon: CompiledIntentLexicon): string[] {
  const result: string[] = [];
  let index = 0;
  while (index < tokens.length) {
    const filler = lexicon.fillers.find((candidate) => candidate.every((word, offset) => tokens[index + offset] === word));
    if (filler) index += filler.length;
    else {
      result.push(tokens[index] as string);
      index += 1;
    }
  }
  return result;
}

// Punctuation and separator words split the input into clauses of normalized tokens.
function clausesOf(input: string, lexicon: CompiledIntentLexicon): string[][] {
  const clauses: string[][] = [];
  for (const segment of input.toLowerCase().replace(/[’‘]/g, "'").split(/[,;.!?:\n]+/)) {
    let current: string[] = [];
    for (const word of words(segment)) {
      for (const token of expandWord(word, lexicon)) {
        if (lexicon.separators.has(token)) {
          clauses.push(current);
          current = [];
        } else if (token) current.push(token);
      }
    }
    clauses.push(current);
  }
  return clauses.map((tokens) => stripFillers(tokens, lexicon)).filter((tokens) => tokens.length > 0);
}

// Removes negation words (and the auxiliary right before one); reports whether any existed.
function resolveNegation(tokens: readonly string[], lexicon: CompiledIntentLexicon): { negated: boolean; rest: string[] } {
  const rest: string[] = [];
  let negated = false;
  for (const token of tokens) {
    if (lexicon.negations.has(token)) {
      negated = true;
      const previous = rest[rest.length - 1];
      if (previous !== undefined && lexicon.auxiliaries.has(previous)) rest.pop();
    } else rest.push(token);
  }
  return { negated, rest };
}

function topicAliases(name: string, lexicon: CompiledIntentLexicon, profile: ContextProfile): string[][] {
  const names = name === 'topic'
    ? new Set([...Object.keys(lexicon.source.topics), ...Object.keys(profile.topicAliases ?? {})])
    : new Set([name]);
  const aliases: string[][] = [];
  for (const topic of names) {
    for (const alias of [...(lexicon.source.topics[topic] ?? []), ...(profile.topicAliases?.[topic] ?? [])]) {
      const tokens = words(alias).flatMap((word) => expandWord(word, lexicon));
      if (tokens.length > 0) aliases.push(tokens);
    }
  }
  return aliases;
}

function matchesTemplate(
  template: Template, templateIndex: number, tokens: readonly string[], tokenIndex: number,
  aliasesFor: (name: string) => string[][],
): boolean {
  if (templateIndex === template.length) return tokenIndex === tokens.length;
  const part = template[templateIndex] as string;
  const placeholder = PLACEHOLDER.exec(part)?.[1];
  if (!placeholder) {
    return tokens[tokenIndex] === part && matchesTemplate(template, templateIndex + 1, tokens, tokenIndex + 1, aliasesFor);
  }
  return aliasesFor(placeholder).some((alias) =>
    alias.every((word, offset) => tokens[tokenIndex + offset] === word)
    && matchesTemplate(template, templateIndex + 1, tokens, tokenIndex + alias.length, aliasesFor));
}

function matchPhrases(
  mode: 'literal' | 'negated', tokens: readonly string[], lexicon: CompiledIntentLexicon, profile: ContextProfile,
): Set<ContextIntentId> {
  const cache = new Map<string, string[][]>();
  const aliasesFor = (name: string) => {
    let aliases = cache.get(name);
    if (!aliases) cache.set(name, aliases = topicAliases(name, lexicon, profile));
    return aliases;
  };
  const found = new Set<ContextIntentId>();
  for (const phrase of lexicon.phrases) {
    if (phrase.mode === mode && matchesTemplate(phrase.template, 0, tokens, 0, aliasesFor)) found.add(phrase.intent);
  }
  return found;
}

type ClauseReading = { kind: 'unmatched' } | { kind: 'disallowed' } | { kind: 'ambiguous' } | { kind: 'intent'; intent: ContextIntentId };

function readClause(tokens: readonly string[], lexicon: CompiledIntentLexicon, profile: ContextProfile): ClauseReading {
  const bare = bareReadings(profile, lexicon).get(tokens.join(' '));
  let found: Set<ContextIntentId>;
  if (bare) found = new Set([bare]);
  else {
    found = matchPhrases('literal', tokens, lexicon, profile);
    if (found.size === 0) {
      const { negated, rest } = resolveNegation(tokens, lexicon);
      if (negated && rest.length > 0) found = matchPhrases('negated', rest, lexicon, profile);
    }
  }
  if (found.size === 0) return { kind: 'unmatched' };
  const allowed = [...found].filter((intent) => profile.allowedIntents.includes(intent));
  if (allowed.length === 0) return { kind: 'disallowed' };
  if (allowed.length > 1) return { kind: 'ambiguous' };
  return { kind: 'intent', intent: allowed[0] as ContextIntentId };
}

function bareReadings(profile: ContextProfile, lexicon: CompiledIntentLexicon): Map<string, ContextIntentId> {
  const readings = new Map<string, ContextIntentId>();
  for (const [word, intent] of Object.entries(profile.bareWords ?? {})) {
    const tokens = stripFillers(words(word).flatMap((part) => expandWord(part, lexicon)), lexicon);
    if (tokens.length > 0) readings.set(tokens.join(' '), intent);
  }
  return readings;
}

function compatible(a: ContextIntentId, b: ContextIntentId, lexicon: CompiledIntentLexicon): boolean {
  return lexicon.source.compatible.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

export function detectContextIntent(
  input: string, profileInput: ContextProfile | ContextProfileInput, lexicon: CompiledIntentLexicon = DEFAULT_INTENT_LEXICON,
): IntentResult {
  const profile = contextProfileSchema.parse(profileInput);
  const clauses = clausesOf(input, lexicon);
  if (clauses.length === 0) return { status: 'unclear', reason: 'no_match' };

  const accepted: ContextIntentId[] = [];
  for (const [index, clause] of clauses.entries()) {
    const reading = readClause(clause, lexicon, profile);
    if (reading.kind === 'ambiguous') return { status: 'unclear', reason: 'ambiguous' };
    if (reading.kind === 'unmatched') return { status: 'unclear', reason: 'no_match' };
    if (reading.kind === 'disallowed') {
      // The first clause is the answer; a later clause outside the profile is simply not used.
      if (index === 0) return { status: 'unclear', reason: 'no_match' };
      continue;
    }
    if (accepted.includes(reading.intent)) continue;
    if (accepted.some((existing) => !compatible(existing, reading.intent, lexicon))) {
      return { status: 'unclear', reason: 'conflicting' };
    }
    accepted.push(reading.intent);
  }
  const [primary, ...modifiers] = accepted;
  return primary === undefined
    ? { status: 'unclear', reason: 'no_match' }
    : { status: 'matched', primary, modifiers };
}
