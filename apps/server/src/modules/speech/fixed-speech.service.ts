import type { SpeechAudioStorage } from './speech-audio.storage';
import type { SpeechCacheRecord, SpeechCacheRepository } from './speech-cache.repository';
import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';

export const SPEECH_CACHE_REPOSITORY = Symbol('SPEECH_CACHE_REPOSITORY');
export const SPEECH_AUDIO_STORAGE = Symbol('SPEECH_AUDIO_STORAGE');
export const SPEECH_GENERATOR = Symbol('SPEECH_GENERATOR');

export interface SpeechGenerationSettings { effect?: string }

export interface SpeechCacheIdentity {
  text: string;
  language: string;
  voice: string;
  style: string;
  format: string;
  ttsVersion: string;
  settings: Readonly<SpeechGenerationSettings>;
}

export interface SpeechGenerator { synthesize(input: SpeechCacheIdentity): Promise<Buffer> }

function generationSettings(settings: SpeechCacheIdentity['settings']): SpeechGenerationSettings {
  return settings.effect === undefined ? {} : { effect: settings.effect };
}

export function speechCacheKey(input: SpeechCacheIdentity): string {
  const canonical = JSON.stringify({
    text: input.text,
    language: input.language,
    voice: input.voice,
    style: input.style,
    format: input.format,
    ttsVersion: input.ttsVersion,
    settings: generationSettings(input.settings),
  });
  return createHash('sha256').update(canonical).digest('hex');
}

@Injectable()
export class FixedSpeechService {
  constructor(@Inject(SPEECH_CACHE_REPOSITORY) private readonly repository: SpeechCacheRepository,
    @Inject(SPEECH_AUDIO_STORAGE) private readonly storage: SpeechAudioStorage,
    @Inject(SPEECH_GENERATOR) private readonly generator: SpeechGenerator) {}

  get(input: SpeechCacheIdentity): Promise<{ cacheKey: string; path: string; url: string }> {
    const cacheKey = speechCacheKey(input);
    return this.repository.exclusive(cacheKey, async records => {
      const existing = await records.find(cacheKey);
      if (existing) return { cacheKey, path: existing.path, url: await this.storage.signedUrl(existing.path) };

      const audio = await this.generator.synthesize(input);
      const path = `fixed/${cacheKey}.mp3`;
      await this.storage.upload(path, audio);
      const record: SpeechCacheRecord = {
        cacheKey,
        path,
        bytes: audio.length,
        language: input.language,
        voice: input.voice,
        style: input.style,
        format: input.format,
        ttsVersion: input.ttsVersion,
        settings: generationSettings(input.settings),
      };
      try { await records.save(record); }
      catch (error: unknown) { await this.storage.remove(path).catch(() => undefined); throw error; }
      return { cacheKey, path, url: await this.storage.signedUrl(path) };
    });
  }
}
