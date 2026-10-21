import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isSafeAiOutput } from '../ai/ai-safety';
import type { SpeechAudioStorage } from './speech-audio.storage';
import type { AiSpeechRepository } from './ai-speech.repository';
import { SPEECH_AUDIO_STORAGE, SPEECH_GENERATOR, speechCacheKey, type SpeechCacheIdentity, type SpeechGenerator } from './fixed-speech.service';

export const AI_SPEECH_REPOSITORY = Symbol('AI_SPEECH_REPOSITORY');
export type AiSpeechIdentity = Omit<SpeechCacheIdentity, 'text'>;
const DEFAULT_TTL_SECONDS = 300;

function cacheable(text: string): boolean {
  const sensitive = /(?:\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b|https?:\/\/|\b(?:password|access token|api key|secret)\b|\b(?:my|your|player(?:'s)?|user(?:'s)?|learner(?:'s)?)\s+(?:real\s+)?(?:name|email|address|phone|location|account|password)\b|\b\d[\d ()+-]{5,}\d\b|\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b)/i;
  return isSafeAiOutput(text) && !sensitive.test(text);
}

@Injectable()
export class AiSpeechService {
  private readonly ttlSeconds: number;

  constructor(@Inject(AI_SPEECH_REPOSITORY) private readonly repository: AiSpeechRepository,
    @Inject(SPEECH_AUDIO_STORAGE) private readonly storage: SpeechAudioStorage,
    @Inject(SPEECH_GENERATOR) private readonly generator: SpeechGenerator,
    config: ConfigService) {
    const configured = config.get<string>('AI_SPEECH_CACHE_TTL_SECONDS')?.trim();
    const ttl = configured === undefined || configured === '' ? DEFAULT_TTL_SECONDS : Number(configured);
    if (!Number.isInteger(ttl) || ttl < 30 || ttl > 3600) {
      throw new Error('AI_SPEECH_CACHE_TTL_SECONDS must be a whole number from 30 to 3600.');
    }
    this.ttlSeconds = ttl;
  }

  async get(userId: string, messageId: string, identity: AiSpeechIdentity): Promise<{ cacheKey: string; path: string; url: string }> {
    const message = await this.repository.message(userId, messageId);
    if (!message) throw new NotFoundException('AI reply not found.');
    if (!cacheable(message.text)) throw new BadRequestException('AI reply is not eligible for speech caching.');
    await this.removeExpired();
    const input: SpeechCacheIdentity = { ...identity, text: message.text };
    const cacheKey = speechCacheKey(input);
    return this.repository.exclusive(cacheKey, async records => {
      const existing = await records.find(cacheKey);
      if (existing && existing.expiresAt.getTime() > Date.now()) {
        return { cacheKey, path: existing.path, url: await this.storage.signedUrl(existing.path) };
      }
      if (existing) {
        await this.storage.remove(existing.path);
        await records.remove(cacheKey);
      }
      const audio = await this.generator.synthesize(input);
      const path = `ai/${cacheKey}.mp3`;
      await this.storage.upload(path, audio);
      try {
        await records.save({ cacheKey, path, bytes: audio.length,
          expiresAt: new Date(Date.now() + this.ttlSeconds * 1000) });
      } catch (error: unknown) {
        await this.storage.remove(path).catch(() => undefined);
        throw error;
      }
      return { cacheKey, path, url: await this.storage.signedUrl(path) };
    });
  }

  private async removeExpired(): Promise<void> {
    for (const stale of await this.repository.expired(20)) {
      await this.repository.exclusive(stale.cacheKey, async records => {
        const current = await records.find(stale.cacheKey);
        if (!current || current.expiresAt.getTime() > Date.now()) return;
        await this.storage.remove(current.path);
        await records.remove(current.cacheKey);
      });
    }
  }
}
