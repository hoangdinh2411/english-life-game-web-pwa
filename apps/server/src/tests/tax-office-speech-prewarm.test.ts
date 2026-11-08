import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { loadSeedContent } from '../infrastructure/content/seed-content';
import { prewarmTaxOfficeSpeech, taxOfficeFixedSpeech } from '../modules/speech/tax-office-speech-prewarm';
import type { SpeechCacheIdentity } from '../modules/speech/fixed-speech.service';

test('tax-office prewarm includes authored dialogue and application prompts but not the dynamic summary', async () => {
  const content = await loadSeedContent(resolve('../../content'));
  const texts = taxOfficeFixedSpeech(content);
  assert.ok(texts.includes('Hello! How can I help you?'));
  assert.ok(texts.includes(content.idCardApplication.prompts.review));
  assert.ok(texts.includes(content.idCardApplication.cancelled));
  assert.ok(!texts.includes(content.idCardApplication.reviewTemplate));
});

test('tax-office prewarm generates each distinct voice, style and text cache entry once', async () => {
  const content = await loadSeedContent(resolve('../../content'));
  const generated: SpeechCacheIdentity[] = [];
  const profiles = { identity: async (npcId: string, mood: string) => ({ language: 'en-US', voice: npcId,
    style: mood === 'happy' ? 'cheerful' : 'default', format: 'mp3', ttsVersion: 'test', settings: {} }) };
  const fixed = { get: async (identity: SpeechCacheIdentity) => {
    generated.push(identity); return { cacheKey: 'key', path: 'path', url: 'https://example.com/audio.mp3' };
  } };
  const count = await prewarmTaxOfficeSpeech(content, profiles as never, fixed as never);
  assert.equal(count, generated.length);
  assert.equal(new Set(generated.map(value => JSON.stringify(value))).size, generated.length);
  assert.ok(count > taxOfficeFixedSpeech(content).length);
});
