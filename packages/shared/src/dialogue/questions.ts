import rules from './content/questions.common.json';

export function splitGreeting(input: string): { greeting: boolean; body: string } {
  const text = input.trim();
  const prefix = new RegExp(rules.greetingPrefix, 'i');
  return { greeting: prefix.test(text), body: text.replace(prefix, '').trim() };
}

function startsQuestion(text: string): boolean {
  return rules.directQuestionPatterns.some((pattern) => new RegExp(pattern, 'i').test(text));
}

function finalQuestion(input: string): { sentence: string; offset: number } | undefined {
  const body = splitGreeting(input).body;
  const sentence = body.split(/[.!?]\s+/).at(-1)?.trim() ?? '';
  if (startsQuestion(sentence)) return { sentence, offset: 0 };
  // Only split clear independent statements, never quoted/embedded questions.
  if (!new RegExp(rules.statementBeforeQuestion, 'i').test(sentence) || new RegExp(rules.embeddedQuestionMarkers, 'i').test(sentence)) return undefined;
  for (const match of sentence.matchAll(/\s+(?=[a-z])/gi)) {
    const offset = match.index + match[0].length;
    if (startsQuestion(sentence.slice(offset))) return { sentence, offset };
  }
  return undefined;
}

export function isDirectQuestion(input: string): boolean {
  const body = splitGreeting(input).body;
  if (body.endsWith('?')) return true;
  return finalQuestion(input) !== undefined;
}

// Presentation only: never change the original input saved in conversation history.
export function formatPlayerMessage(input: string): string {
  const text = input.trim();
  if (!isDirectQuestion(text)) return text;
  const question = finalQuestion(text);
  let formatted = text;
  if (question && question.offset > 0) {
    const start = formatted.lastIndexOf(question.sentence);
    const boundary = start + question.offset;
    formatted = `${formatted.slice(0, boundary).trimEnd()}. ${formatted.slice(boundary)}`;
  }
  // A greeting needs its own boundary when speech recognition omitted it.
  formatted = formatted.replace(new RegExp(rules.unpunctuatedGreeting, 'i'), '$1! ');
  formatted = formatted.replace(/(^|[.!?]\s+)([a-z])/g, (_, prefix: string, letter: string) => prefix + letter.toUpperCase());
  formatted = formatted.replace(/\bi\b/g, 'I');
  return `${formatted.replace(/[.!?]+$/, '')}?`;
}
