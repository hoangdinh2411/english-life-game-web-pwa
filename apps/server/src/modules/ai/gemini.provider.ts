import { ConfigService } from '@nestjs/config';
import { AiProvider, AiReplyRequest } from './ai-provider';
import { NPC_SYSTEM_PROMPT, npcUserPrompt } from './prompts';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function replyText(body: unknown): string {
  const candidate: unknown = record(body) && Array.isArray(body.candidates) ? body.candidates[0] : undefined;
  if (!record(candidate) || candidate.finishReason !== 'STOP' || !record(candidate.content)
    || !Array.isArray(candidate.content.parts)) throw new Error('AI reply was incomplete or blocked.');
  const parts: unknown[] = candidate.content.parts;
  const text = parts.map(part => record(part) && part.thought !== true && typeof part.text === 'string'
    ? part.text : '').join('').trim();
  if (!text) throw new Error('AI reply was empty.');
  return text;
}

export class GeminiProvider implements AiProvider {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(config: ConfigService, private readonly request: typeof fetch = fetch) {
    this.apiKey = config.get<string>('AI_API_KEY')?.trim() ?? '';
    this.model = config.get<string>('AI_MODEL')?.trim() ?? '';
    if (!this.apiKey || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(this.model)) {
      throw new Error('Gemini requires AI_API_KEY and a valid AI_MODEL.');
    }
  }

  async reply(input: AiReplyRequest, signal: AbortSignal): Promise<string> {
    const response = await this.request(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`,
      {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: input.prompt?.system ?? NPC_SYSTEM_PROMPT }] },
          contents: [...(input.prompt?.history ?? []).map(message => ({
            role: message.speaker === 'player' ? 'user' : 'model', parts: [{ text: message.text }],
          })), { role: 'user', parts: [{ text: npcUserPrompt(input) }] }],
        }),
      },
    );
    // Do not include provider bodies/URLs in errors: they can contain private data.
    if (!response.ok) throw new Error('AI provider request failed.');
    const body: unknown = await response.json();
    return replyText(body);
  }
}
