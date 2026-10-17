import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DialogueContext, DialogueService } from '../dialogue/dialogue.service';
import { AI_PROVIDER, AiProvider, AiPrompt } from './ai-provider';
import { isSafeAiOutput, safeAiInput } from './ai-safety';

export const AI_REPLY_TIMEOUT_MS = 20_000;

export interface AiReplyResult {
  text: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  fallback: boolean;
  usedProvider: boolean;
}

export type AiChunkHandler = (text: string) => void | Promise<void>;

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

  async replyTrackedStream(context: DialogueContext, text: string, prompt: AiPrompt | undefined,
    onChunk: AiChunkHandler, signal?: AbortSignal): Promise<AiReplyResult> {
    if (!this.provider.stream) {
      const result = await this.replyTracked(context, text, prompt, signal);
      if (!result.fallback) await onChunk(result.text);
      return result;
    }
    const fallback = await this.dialogue.node(context, 'global_repeat');
    const provider = this.config.get<string>('AI_PROVIDER')?.trim() || 'mock';
    const model = provider === 'mock' ? 'mock' : this.config.get<string>('AI_MODEL')?.trim() || 'unknown';
    const inputTokens = estimatedTokens(prompt?.system ?? '', ...(prompt?.history.map(message => message.text) ?? []), text);
    const fallbackResult = (): AiReplyResult => ({
      text: fallback.text, provider, model, inputTokens, outputTokens: 0, fallback: true, usedProvider: true,
    });
    if (!this.enabled) return { ...fallbackResult(), usedProvider: false };
    const safeText = safeAiInput(text);
    if (!safeText) return { ...fallbackResult(), usedProvider: false };
    if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error('AI reply cancelled.');
    const controller = new AbortController();
    const cancel = (): void => controller.abort(signal?.reason);
    signal?.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(() => controller.abort(new Error('AI reply timed out.')), AI_REPLY_TIMEOUT_MS);
    let accepted = '';
    let pending = '';
    try {
      for await (const chunk of this.provider.stream({ npcId: context.npcId, text: safeText,
        ...(prompt ? { prompt } : {}) }, controller.signal)) {
        pending += chunk;
        let boundary = pending.search(/[.!?](?:\s+|$)/);
        while (boundary >= 0) {
          const end = boundary + 1;
          const trailing = pending.slice(end).match(/^\s*/)?.[0] ?? '';
          const sentence = pending.slice(0, end) + trailing;
          const candidate = accepted + sentence;
          if (!isSafeAiOutput(candidate)) {
            controller.abort(new Error('AI reply was unsafe.'));
            return accepted.trim() ? this.streamResult(accepted, provider, model, inputTokens) : fallbackResult();
          }
          accepted = candidate;
          pending = pending.slice(end + trailing.length);
          await onChunk(sentence);
          boundary = pending.search(/[.!?](?:\s+|$)/);
        }
      }
      if (pending.trim()) {
        const candidate = accepted + pending;
        if (!isSafeAiOutput(candidate)) return accepted.trim()
          ? this.streamResult(accepted, provider, model, inputTokens) : fallbackResult();
        accepted = candidate;
        await onChunk(pending);
      }
      return accepted.trim() ? this.streamResult(accepted, provider, model, inputTokens) : fallbackResult();
    } catch {
      if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error('AI reply cancelled.');
      return accepted.trim() ? this.streamResult(accepted, provider, model, inputTokens) : fallbackResult();
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
    }
  }

  private streamResult(text: string, provider: string, model: string, inputTokens: number): AiReplyResult {
    const clean = text.trim();
    return { text: clean, provider, model, inputTokens, outputTokens: estimatedTokens(clean), fallback: false, usedProvider: true };
  }
}
