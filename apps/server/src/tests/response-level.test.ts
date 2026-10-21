import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveResponseLevel } from '../modules/ai/response-level';

test('response level defaults to A2 when learner data is unavailable', () => {
  assert.equal(resolveResponseLevel(null, 'I can explain this in detail because it matters to me.'), 'A2');
  assert.equal(resolveResponseLevel('unknown', 'Hi?'), 'A2');
});

test('observable input complexity moves at most one CEFR band', () => {
  assert.equal(resolveResponseLevel('B1', 'Can you help?'), 'A2');
  assert.equal(resolveResponseLevel('B1',
    'I would like to understand this process because I have tried it twice, but I still feel uncertain.'), 'B2');
  assert.equal(resolveResponseLevel('A1', 'Can you help?'), 'A1');
  assert.equal(resolveResponseLevel('C1',
    'I would like to understand this process because I have tried it twice, but I still feel uncertain.'), 'C1');
});

test('ambiguous input does not change the stored level', () => {
  assert.equal(resolveResponseLevel('B1', 'purple flying sandwich'), 'B1');
  assert.equal(resolveResponseLevel('B1', '...'), 'B1');
});
