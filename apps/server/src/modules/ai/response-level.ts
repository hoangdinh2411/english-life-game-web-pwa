export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;
export type CefrLevel = typeof CEFR_LEVELS[number];

function storedLevel(value: string | null | undefined): CefrLevel | undefined {
  return CEFR_LEVELS.find(level => level === value?.toUpperCase());
}

function hasObservableMeaning(text: string): boolean {
  return /[a-z]/i.test(text) && (/[?]/.test(text)
    || /\b(?:i|you|we|they|he|she|it)\s+(?:am|are|is|was|were|have|has|like|want|need|feel|think|work|live|go|do|can|could|would|will)\b/i.test(text));
}

export function resolveResponseLevel(playerLevel: string | null | undefined, text: string): CefrLevel {
  const level = storedLevel(playerLevel);
  if (!level) return 'A2';

  const words = text.trim().match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) ?? [];
  if (!hasObservableMeaning(text)) return level;

  const index = CEFR_LEVELS.indexOf(level);
  const clauses = text.match(/[.!?]+|\b(?:although|because|however|unless|while|therefore)\b/gi)?.length ?? 0;
  if (words.length >= 16 || clauses >= 2) return CEFR_LEVELS[Math.min(index + 1, CEFR_LEVELS.length - 1)]!;
  if (words.length <= 7 && clauses <= 1) return CEFR_LEVELS[Math.max(index - 1, 0)]!;
  return level;
}
