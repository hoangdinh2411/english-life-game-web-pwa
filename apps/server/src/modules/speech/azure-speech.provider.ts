import { ConfigService } from '@nestjs/config';

export type NpcEmotion = 'neutral' | 'happy' | 'sad';
export type AzureSpeechStyle = 'default' | 'cheerful' | 'sad';
export const AZURE_SPEECH_LANGUAGE = 'en-US' as const;
export const AZURE_SPEECH_VERSION = 'rest-v1' as const;
export const AZURE_SPEECH_FORMAT = 'audio-24khz-48kbitrate-mono-mp3' as const;
// Speech is optional; leave time for the authenticated conversation response
// to return text before the client's 15-second request deadline.
export const AZURE_SPEECH_TIMEOUT_MS = 7_000;

export interface AzureSpeechInput {
  text: string;
  voice: string;
  emotion: NpcEmotion;
  supportedStyles: readonly Exclude<AzureSpeechStyle, 'default'>[];
}

export interface AzureSpeechResult {
  audio: Buffer;
  metadata: {
    provider: 'azure'; version: typeof AZURE_SPEECH_VERSION; language: typeof AZURE_SPEECH_LANGUAGE; voice: string;
    emotion: NpcEmotion; style: AzureSpeechStyle; format: typeof AZURE_SPEECH_FORMAT;
  };
}

export function resolveAzureStyle(emotion: NpcEmotion,
  supported: readonly Exclude<AzureSpeechStyle, 'default'>[]): AzureSpeechStyle {
  const requested = emotion === 'happy' ? 'cheerful' : emotion === 'sad' ? 'sad' : 'default';
  return requested !== 'default' && supported.includes(requested) ? requested : 'default';
}

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

export class AzureSpeechProvider {
  private readonly endpoint: string;
  private readonly key: string;

  constructor(config: ConfigService, private readonly request: typeof fetch = fetch,
    private readonly timeoutMs = AZURE_SPEECH_TIMEOUT_MS) {
    const region = config.get<string>('AZURE_SPEECH_REGION')?.trim() ?? '';
    this.key = config.get<string>('AZURE_SPEECH_KEY')?.trim() ?? '';
    this.endpoint = /^[a-z0-9-]+$/.test(region) ? `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1` : '';
  }

  async synthesize(input: AzureSpeechInput, signal?: AbortSignal): Promise<AzureSpeechResult> {
    if (!this.endpoint || !this.key) throw new Error('Azure Speech requires a valid region and key.');
    const style = resolveAzureStyle(input.emotion, input.supportedStyles);
    const content = style === 'default' ? escapeXml(input.text)
      : `<mstts:express-as style="${style}">${escapeXml(input.text)}</mstts:express-as>`;
    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US"><voice name="${escapeXml(input.voice)}">${content}</voice></speak>`;
    let response: Response;
    const timeoutController = new AbortController();
    const timeout = setTimeout(() => timeoutController.abort(), this.timeoutMs);
    try {
      const requestSignal = signal ? AbortSignal.any([signal, timeoutController.signal]) : timeoutController.signal;
      response = await this.request(this.endpoint, { method: 'POST', signal: requestSignal, headers: {
        'Ocp-Apim-Subscription-Key': this.key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': AZURE_SPEECH_FORMAT,
        'User-Agent': 'life-abroad-server',
      }, body: ssml });
    } catch { throw new Error('Azure speech generation failed.'); }
    finally { clearTimeout(timeout); }
    if (!response.ok) throw new Error('Azure speech generation failed.');
    const audio = Buffer.from(await response.arrayBuffer());
    if (!audio.length) throw new Error('Azure speech generation failed.');
    return { audio, metadata: { provider: 'azure', version: AZURE_SPEECH_VERSION, language: AZURE_SPEECH_LANGUAGE, voice: input.voice,
      emotion: input.emotion, style, format: AZURE_SPEECH_FORMAT } };
  }
}
