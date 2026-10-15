import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReview } from '../modules/learning/review-history';
import type { LearningHistoryTurn } from '@life-abroad/shared';

const feedback = { original: 'I want coffee', improved: 'I would like coffee.',
  reason: 'Use would like for a polite request.', question: 'you would like coffee' };
const turn: LearningHistoryTurn = { id: '11111111-1111-4111-8111-111111111111',
  createdAt: '2026-10-14T09:00:00.000Z', npcId: 'npc_mia', text: 'I want coffee',
  metadata: { intent: 'order', correction: feedback } };

test('review shows a saved coffee-order phrase and its correction', () => {
  assert.deepEqual(buildReview([turn]), {
    phrases: [{ phrase: "I'd like…", example: 'I would like coffee.' }],
    corrections: [{ id: turn.id, createdAt: '2026-10-14T09:00:00.000Z', feedback }],
  });
});

test('review deduplicates useful phrases and excludes unrelated words, failed orders and non-shop phrases', () => {
  assert.deepEqual(buildReview([
    { ...turn, text: "I'd like a coffee, please.", metadata: { intent: 'order', correction: null } },
    { ...turn, text: 'I would like tea.', metadata: { intent: 'order' } },
    { ...turn, npcId: 'npc_clothes_seller', text: 'How much is the blue shirt?', metadata: { intent: 'ask_price' } },
    { ...turn, text: 'Coffee', metadata: { intent: 'order' } },
    { ...turn, text: "I'd like gold.", metadata: { intent: 'unknown_item' } },
    { ...turn, npcId: 'npc_receptionist', text: "I'd like a ticket.", metadata: { intent: 'order' } },
    { ...turn, metadata: { correction: { invalid: true } } },
  ]), { phrases: [
    { phrase: "I'd like…", example: "I'd like a coffee, please." },
    { phrase: 'How much is…?', example: 'How much is the blue shirt?' },
  ], corrections: [] });
});

test('review handles empty history and bounds past corrections', () => {
  assert.deepEqual(buildReview([]), { phrases: [], corrections: [] });
  assert.equal(buildReview(Array.from({ length: 30 }, () => turn)).corrections.length, 20);
});
