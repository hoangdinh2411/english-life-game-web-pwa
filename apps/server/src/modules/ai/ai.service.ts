import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DialogueContext, DialogueService } from '../dialogue/dialogue.service';
import { AI_PROVIDER, AiProvider, AiPrompt } from './ai-provider';
import { isSafeAiOutput, safeAiInput } from './ai-safety';

export const AI_REPLY_TIMEOUT_MS = 5_000;

@Injectable()
export class AiService {
  constructor(
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
    private readonly dialogue: DialogueService,
    private readonly config: ConfigService,
  ) {}

  get enabled(): boolean { return this.config.get<string>('AI_ENABLED') === 'true'; }

  async reply(context: DialogueContext, text: string, prompt?: AiPrompt): Promise<string> {
    // Resolve authored fallback before calling an external provider. Never expose
    // provider errors (which may contain keys or private text) to clients/logs.
    const fallback = await this.dialogue.node(context, 'global_repeat');
    if (!this.enabled) return fallback.text;
    const safeText = safeAiInput(text);
    if (!safeText) return fallback.text;
    const controller = new AbortController();
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
      return typeof reply === 'string' && isSafeAiOutput(reply) ? reply.trim() : fallback.text;
    } catch {
      return fallback.text;
    } finally {
      clearTimeout(timer);
    }
  }
}
