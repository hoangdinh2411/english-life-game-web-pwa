import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  contextProfileSchema, DEFAULT_INTENT_LEXICON, detectContextIntent,
  type CompiledIntentLexicon, type ContextProfile, type ContextProfileInput, type IntentResult,
} from '@life-abroad/shared';
import { DialogueContext, DialogueService } from '../dialogue/dialogue.service';
import { AI_PROVIDER, AiProvider, AiPrompt } from './ai-provider';
import { isSafeAiOutput, safeAiInput } from './ai-safety';
import { intentClassificationPrompt, validateAiIntentOutput } from './prompts';

export const AI_REPLY_TIMEOUT_MS = 20_000;

const SENSITIVE_INTENT_PROFILE = /^(?:id_card|cafe|clothes|seller|shop|economy|payment|purchase|reward|quest)(?:_|$)/;
const SAFE_CONTEXT_KEYS = new Set(['npcId', 'roleId', 'personality']);

export interface AiIntentContext {
  readonly npcId: string;
  readonly privateNames?: readonly string[];
  readonly [key: string]: unknown;
}

function collectRedactedTerms(context: AiIntentContext): string[] {
  const terms = new Set<string>();
  for (const name of context.privateNames ?? []) {
    if (typeof name === 'string' && name.trim().length >= 2) terms.add(name.trim());
  }
  const visit = (value: unknown): void => {
    if (typeof value === 'string') {
      if (value.trim().length >= 2) terms.add(value.trim());
    } else if (Array.isArray(value)) {
      for (const item of value) visit(item);
    } else if (typeof value === 'object' && value !== null) {
      for (const item of Object.values(value)) visit(item);
    }
  };
  for (const [key, value] of Object.entries(context)) {
    if (!SAFE_CONTEXT_KEYS.has(key) && key !== 'privateNames') visit(value);
  }
  return [...terms];
}

function scrubIntentInput(text: string, privateNames: readonly string[] = []): string {
  let clean = text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[private]')
    .replace(/\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b/gi, '[private]')
    .replace(/\b\d{8}-?\d{4}\b/g, '[private]')
    .replace(/\b(?:19|20)\d{2}-\d{2}-\d{2}\b/g, '[private]');
  for (const name of privateNames.filter(candidate => candidate.trim())) {
    const escaped = name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    clean = clean.replace(new RegExp(escaped, 'gi'), '[private]');
  }
  return clean;
}

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

  async classifyIntent(
    context: string | AiIntentContext,
    text: string,
    profileInput: ContextProfile | ContextProfileInput,
    signal?: AbortSignal,
    lexicon: CompiledIntentLexicon = DEFAULT_INTENT_LEXICON,
  ): Promise<IntentResult> {
    const profile = contextProfileSchema.parse(profileInput);
    const ruleResult = detectContextIntent(text, profile, lexicon);
    if (ruleResult.status === 'matched' || ruleResult.reason === 'conflicting') {
      return ruleResult;
    }
    if (!profile.aiFallback || !this.enabled || SENSITIVE_INTENT_PROFILE.test(profile.id)) {
      return ruleResult;
    }
    const safeRaw = safeAiInput(text);
    if (!safeRaw) return { status: 'unclear', reason: 'no_match' };
    const npcId = typeof context === 'string' ? context : context.npcId;
    const redactedTerms = typeof context === 'string' ? [] : collectRedactedTerms(context);
    const safeText = safeAiInput(scrubIntentInput(safeRaw, redactedTerms));
    if (!safeText) return { status: 'unclear', reason: 'no_match' };
    if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error('AI intent classification cancelled.');
    const controller = new AbortController();
    const cancel = (): void => controller.abort(signal?.reason);
    signal?.addEventListener('abort', cancel, { once: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new Error('AI intent classification timed out.'));
          controller.abort();
        }, AI_REPLY_TIMEOUT_MS);
      });
      const prompt = intentClassificationPrompt(profile);
      const reply = await Promise.race([
        this.provider.reply({ npcId, text: safeText, prompt }, controller.signal),
        timeout,
      ]);
      return validateAiIntentOutput(reply, profile, lexicon);
    } catch {
      if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error('AI intent classification cancelled.');
      return { status: 'unclear', reason: 'no_match' };
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
    }
  }
}
