import assert from 'node:assert/strict';
import test from 'node:test';
import {
  movementTutorialNarration,
  movementTutorialPageIdSchema,
} from '@life-abroad/shared';
import type { SpeechCacheIdentity } from '../modules/speech/fixed-speech.service';
import { TutorialSpeechService } from '../modules/speech/tutorial-speech.service';

const identity = {
  language: 'en-US',
  voice: 'en-US-AvaNeural',
  style: 'default',
  format: 'audio-24khz-48kbitrate-mono-mp3',
  ttsVersion: 'rest-v1',
  settings: {},
} as const;

test('tutorial speech accepts only the five trusted page IDs', () => {
  for (const pageId of ['move', 'interact', 'goals', 'practice', 'menu']) {
    assert.equal(movementTutorialPageIdSchema.parse(pageId), pageId);
  }
  assert.equal(movementTutorialPageIdSchema.safeParse('arbitrary-costly-text').success, false);
});

test('tutorial speech sends trusted page copy through cached Azure speech', async () => {
  const generated: SpeechCacheIdentity[] = [];
  const service = new TutorialSpeechService({ get: async (input: SpeechCacheIdentity) => {
    generated.push(input);
    return { cacheKey: 'key', path: 'fixed/key.mp3', url: 'https://audio.test/tutorial.mp3' };
  } } as never, { tutorialIdentity: async () => identity } as never);

  assert.deepEqual(await service.get('practice'), { url: 'https://audio.test/tutorial.mp3' });
  assert.deepEqual(generated, [{ ...identity, text: movementTutorialNarration('practice') }]);
});
