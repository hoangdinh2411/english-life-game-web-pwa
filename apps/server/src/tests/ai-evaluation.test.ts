import assert from 'node:assert/strict';
import test from 'node:test';
import type { AiProvider } from '../modules/ai/ai-provider';
import { AI_EVALUATION_CASES, runAiEvaluation } from '../modules/ai/ai-evaluation';

// Catches an incomplete dataset or runner that hides replies and unsafe-output flags.
test('T10g evaluates 20 conversation messages plus every T10d safety input and prints every result', async () => {
  assert.equal(AI_EVALUATION_CASES.filter(item => item.kind === 'conversation').length, 20);
  assert.equal(AI_EVALUATION_CASES.filter(item => item.kind === 'safety').length, 8);
  const lines: string[] = [];
  const provider: AiProvider = { reply: async request => request.text === 'What music do you enjoy?'
    ? '**Unsafe markdown**' : 'I enjoy that too. What do you like about it?' };
  const result = await runAiEvaluation(provider, 'test-provider', AI_EVALUATION_CASES, line => lines.push(line));
  assert.equal(result.total, 28);
  assert.equal(result.blockedInputs, 8);
  assert.equal(result.unsafeOutputs, 1);
  assert.equal(result.errors, 0);
  assert.equal(result.passed, false);
  assert.equal(lines.filter(line => line.startsWith('Message: ')).length, 28);
  assert.equal(lines.filter(line => line.startsWith('Reply: ')).length, 28);
  assert.ok(lines.some(line => line === 'Flags: unsafe-output'));
  assert.match(lines.at(-1) ?? '', /28 cases.*1 unsafe output.*8 blocked inputs/i);
});

test('T10g flags a generic reply that ignores the football question', async () => {
  const footballCase = AI_EVALUATION_CASES.find(item => item.message === 'Do you like football?');
  assert.ok(footballCase);
  const provider: AiProvider = { reply: async () => 'Hello! What would you like to talk about today?' };
  const lines: string[] = [];
  const result = await runAiEvaluation(provider, 'test-provider', [footballCase], line => lines.push(line));
  assert.equal('offTopicOutputs' in result ? result.offTopicOutputs : undefined, 1);
  assert.equal(result.passed, false);
  assert.ok(lines.includes('Flags: off-topic-output'));
});
