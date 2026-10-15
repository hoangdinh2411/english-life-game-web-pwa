import { Inject, Injectable } from '@nestjs/common';
import { DialogueContext, DialogueService } from '../dialogue/dialogue.service';
import { AI_PROVIDER, AiProvider } from './ai-provider';

export const AI_REPLY_TIMEOUT_MS = 5_000;

@Injectable()
export class AiService {
  constructor(
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
    private readonly dialogue: DialogueService,
  ) {}

  async reply(context: DialogueContext, text: string): Promise<string> {
    // Resolve authored fallback before calling an external provider. Never expose
    // provider errors (which may contain keys or private text) to clients/logs.
    const fallback = await this.dialogue.node(context, 'global_repeat');
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
        this.provider.reply({ npcId: context.npcId, text }, controller.signal),
        timeout,
      ]);
      return typeof reply === 'string' && reply.trim() ? reply.trim() : fallback.text;
    } catch {
      return fallback.text;
    } finally {
      clearTimeout(timer);
    }
  }
}
