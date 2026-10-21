import { Injectable } from '@nestjs/common';
import { AzureSpeechProvider, type NpcEmotion } from './azure-speech.provider';
import type { SpeechCacheIdentity, SpeechGenerator } from './fixed-speech.service';

@Injectable()
export class AzureFixedSpeechGenerator implements SpeechGenerator {
  constructor(private readonly azure: AzureSpeechProvider) {}

  async synthesize(input: SpeechCacheIdentity): Promise<Buffer> {
    const emotion: NpcEmotion = input.style === 'cheerful' ? 'happy' : input.style === 'sad' ? 'sad' : 'neutral';
    const supportedStyles = input.style === 'default' ? [] : [input.style as 'cheerful' | 'sad'];
    return (await this.azure.synthesize({ text: input.text, voice: input.voice, emotion, supportedStyles })).audio;
  }
}
