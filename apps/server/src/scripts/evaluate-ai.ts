import { ConfigService } from '@nestjs/config';
import { AI_EVALUATION_CASES, runAiEvaluation } from '../modules/ai/ai-evaluation';
import type { AiProvider } from '../modules/ai/ai-provider';
import { GeminiProvider } from '../modules/ai/gemini.provider';
import { MockProvider } from '../modules/ai/mock.provider';

function selectedProvider(): { name: string; provider: AiProvider } {
  const option = process.argv.find(argument => argument.startsWith('--provider='));
  const name = option?.slice('--provider='.length).trim() || process.env.AI_PROVIDER?.trim() || 'mock';
  if (name === 'mock') return { name, provider: new MockProvider() };
  if (name === 'gemini') return { name, provider: new GeminiProvider(new ConfigService(process.env)) };
  throw new Error('Unsupported provider. Use --provider=mock or --provider=gemini.');
}

async function main(): Promise<void> {
  const { name, provider } = selectedProvider();
  const result = await runAiEvaluation(provider, name, AI_EVALUATION_CASES);
  if (!result.passed) process.exitCode = 1;
}

void main().catch(error => {
  console.error(error instanceof Error ? error.message : 'AI evaluation failed.');
  process.exitCode = 1;
});
