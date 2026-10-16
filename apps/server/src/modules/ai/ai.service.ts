import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DialogueContext, DialogueService } from '../dialogue/dialogue.service';
import { AI_PROVIDER, AiProvider, AiPrompt } from './ai-provider';
import { isSafeAiOutput, safeAiInput } from './ai-safety';

export const AI_REPLY_TIMEOUT_MS = 5_000;

export interface AiReplyResult {
  text: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  fallback: boolean;
  usedProvider: boolean;
}

function estimatedTokens(...texts: string[]): number {
  return texts.join(' ').match(/[\p{Letter}\p{Number}]+|[^\s\p{Letter}\p{Number}]/gu)?.length ?? 0;
}

@Injectable()
export class AiService {
  constructor(
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
    private readonly dialogue: DialogueService,
    private readonly config: ConfigService,
  ) {}

  get enabled(): boolean { return this.config.get<string>('AI_ENABLED') === 'true'; }

  async reply(context: DialogueContext, text: string, prompt?: AiPrompt, signal?: AbortSignal): Promise<string> {
    return (await this.replyTracked(context, text, prompt, signal)).text;
  }

  async replyTracked(context: DialogueContext, text: string, prompt?: AiPrompt, signal?: AbortSignal): Promise<AiReplyResult> {
    // Resolve authored fallback before calling an external provider. Never expose
    // provider errors (which may contain keys or private text) to clients/logs.
    const fallback = await this.dialogue.node(context, 'global_repeat');
    const provider = this.config.get<string>('AI_PROVIDER')?.trim() || 'mock';
    const model = provider === 'mock' ? 'mock' : this.config.get<string>('AI_MODEL')?.trim() || 'unknown';
    const inputTokens = estimatedTokens(prompt?.system ?? '', ...(prompt?.history.map(message => message.text) ?? []), text);
    const fallbackResult = (usedProvider: boolean, output = ''): AiReplyResult => ({
      text: fallback.text, provider, model, inputTokens, outputTokens: estimatedTokens(output), fallback: true, usedProvider,
    });
    if (!this.enabled) return fallbackResult(false);
    const safeText = safeAiInput(text);
    if (!safeText) return fallbackResult(false);
    if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error('AI reply cancelled.');
    const controller = new AbortController();
    const cancel = (): void => controller.abort(signal?.reason);
    signal?.addEventListener('abort', cancel, { once: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new Error('AI reply timed out.'));
          controller.abort();
        }, AI_REPLY_TIMEOUT_MS);
      });
      // Race also bounds providers that fail to honor cancellation.
      const reply = await Promise.race([
        this.provider.reply({ npcId: context.npcId, text: safeText, ...(prompt ? { prompt } : {}) }, controller.signal),
        timeout,
      ]);
      return typeof reply === 'string' && isSafeAiOutput(reply)
        ? { text: reply.trim(), provider, model, inputTokens, outputTokens: estimatedTokens(reply), fallback: false, usedProvider: true }
        : fallbackResult(true, typeof reply === 'string' ? reply : '');
    } catch {
      if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error('AI reply cancelled.');
      return fallbackResult(true);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
    }
  }
}
