import { SHOP_NPC_IDS, normalizeDialogue, learningMetadataSchema, type LearningReview, type LearningHistoryTurn } from '@life-abroad/shared';

const phrases = [
  { phrase: "I'd like…", pattern: /\b(?:I'd|I would) like\s+\S/i },
  { phrase: 'How much is…?', pattern: /\bhow much is\s+\S/i },
  { phrase: 'Can I have…?', pattern: /\bcan I have\s+\S/i },
  { phrase: 'Could I have…?', pattern: /\bcould I have\s+\S/i },
];

// Conversation messages already persist these examples. Return a curated,
// deduplicated view; never turn every word into a vocabulary entry.
export function buildReview(turns: readonly LearningHistoryTurn[]): LearningReview {
  const review: LearningReview = { phrases: [], corrections: [] };
  const seen = new Set<string>();
  for (const turn of turns) {
    const parsed = learningMetadataSchema.safeParse(turn.metadata);
    if (!parsed.success) continue;
    const { correction, intent } = parsed.data;
    if (correction && review.corrections.length < 20) {
      review.corrections.push({ id: turn.id, createdAt: turn.createdAt, feedback: correction });
    }
    if (!(SHOP_NPC_IDS as readonly string[]).includes(turn.npcId) || !['order', 'ask_price'].includes(intent ?? '')) continue;
    const example = correction?.improved ?? turn.text;
    for (const phrase of phrases) {
      if (seen.has(phrase.phrase) || !phrase.pattern.test(normalizeDialogue(example))) continue;
      seen.add(phrase.phrase);
      review.phrases.push({ phrase: phrase.phrase, example });
    }
  }
  return review;
}
