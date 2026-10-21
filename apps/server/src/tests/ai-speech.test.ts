import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiSpeechService, type AiSpeechIdentity } from '../modules/speech/ai-speech.service';
import type { AiSpeechCacheRecord, AiSpeechCacheRecords, AiSpeechRepository } from '../modules/speech/ai-speech.repository';
import type { SpeechAudioStorage } from '../modules/speech/speech-audio.storage';

const identity: AiSpeechIdentity = {
  language: 'en-US', voice: 'en-US-JennyNeural', style: 'cheerful',
  format: 'audio-24khz-48kbitrate-mono-mp3', ttsVersion: 'rest-v1', settings: {},
};

class MemoryAiRepository implements AiSpeechRepository, AiSpeechCacheRecords {
  readonly messages = new Map<string, string>();
  readonly records = new Map<string, AiSpeechCacheRecord>();
  private pending: Promise<void> = Promise.resolve();

  message(userId: string, messageId: string): Promise<{ text: string } | undefined> {
    const text = this.messages.get(`${userId}:${messageId}`);
    return Promise.resolve(text ? { text } : undefined);
  }
  expired(limit: number): Promise<AiSpeechCacheRecord[]> {
    return Promise.resolve([...this.records.values()].filter(record => record.expiresAt.getTime() <= Date.now()).slice(0, limit));
  }
  async exclusive<T>(_key: string, work: (records: AiSpeechCacheRecords) => Promise<T>): Promise<T> {
    const previous = this.pending;
    let release: () => void = () => undefined;
    this.pending = new Promise<void>(resolve => { release = resolve; });
    await previous;
    try { return await work(this); } finally { release(); }
  }
  find(key: string): Promise<AiSpeechCacheRecord | undefined> { return Promise.resolve(this.records.get(key)); }
  save(record: AiSpeechCacheRecord): Promise<void> { this.records.set(record.cacheKey, record); return Promise.resolve(); }
  remove(key: string): Promise<void> { this.records.delete(key); return Promise.resolve(); }
}

class MemoryAudioStorage implements SpeechAudioStorage {
  readonly files = new Map<string, Buffer>();
  uploads = 0;
  removed: string[] = [];
  upload(path: string, audio: Buffer): Promise<void> { this.uploads += 1; this.files.set(path, audio); return Promise.resolve(); }
  remove(path: string): Promise<void> { this.removed.push(path); this.files.delete(path); return Promise.resolve(); }
  signedUrl(path: string): Promise<string> { return Promise.resolve(`https://private.test/${path}`); }
}

function setup(ttl = '300') {
  const repository = new MemoryAiRepository();
  const storage = new MemoryAudioStorage();
  let generations = 0;
  const service = new AiSpeechService(repository, storage, {
    synthesize: async input => { generations += 1; return Buffer.from(input.text); },
  }, new ConfigService({ AI_SPEECH_CACHE_TTL_SECONDS: ttl }));
  return { repository, storage, service, generations: () => generations };
}

test('exact persisted AI replies reuse audio while changed text calls Azure again', async () => {
  const fixture = setup();
  fixture.repository.messages.set('user:one', 'Autumn is beautiful here.');
  fixture.repository.messages.set('user:two', 'Autumn is beautiful here.');
  fixture.repository.messages.set('user:three', 'Winter is beautiful here.');

  const first = await fixture.service.get('user', 'one', identity);
  const repeated = await fixture.service.get('user', 'two', identity);
  const changed = await fixture.service.get('user', 'three', identity);

  assert.equal(first.path, repeated.path);
  assert.notEqual(first.path, changed.path);
  assert.equal(fixture.generations(), 2);
  assert.equal(fixture.storage.uploads, 2);
  assert.equal(fixture.repository.records.size, 2);
  assert.ok([...fixture.repository.records.values()].every(record => !('text' in record)));
});

test('expired AI audio removes its row and object before regeneration', async () => {
  const fixture = setup('30');
  fixture.repository.messages.set('user:one', 'The park is quiet today.');
  const first = await fixture.service.get('user', 'one', identity);
  const record = fixture.repository.records.get(first.cacheKey)!;
  record.expiresAt = new Date(Date.now() - 1);

  await fixture.service.get('user', 'one', identity);

  assert.equal(fixture.generations(), 2);
  assert.equal(fixture.storage.uploads, 2);
  assert.deepEqual(fixture.storage.removed, [first.path]);
  assert.ok(fixture.repository.records.get(first.cacheKey)!.expiresAt.getTime() > Date.now());
});

test('a request cleans unrelated expired rows and private objects', async () => {
  const fixture = setup();
  fixture.repository.messages.set('user:new', 'A fresh safe reply.');
  fixture.repository.records.set('expired-key', {
    cacheKey: 'expired-key', path: 'ai/expired.mp3', bytes: 5, expiresAt: new Date(Date.now() - 1),
  });
  fixture.storage.files.set('ai/expired.mp3', Buffer.from('stale'));

  await fixture.service.get('user', 'new', identity);

  assert.equal(fixture.repository.records.has('expired-key'), false);
  assert.equal(fixture.storage.files.has('ai/expired.mp3'), false);
  assert.ok(fixture.storage.removed.includes('ai/expired.mp3'));
});

test('AI speech rejects unowned or sensitive text before generation or persistence', async () => {
  const fixture = setup();
  fixture.repository.messages.set('user:sensitive', 'Email me at learner@example.com tomorrow.');

  await assert.rejects(fixture.service.get('other-user', 'sensitive', identity));
  await assert.rejects(fixture.service.get('user', 'sensitive', identity), BadRequestException);
  assert.equal(fixture.generations(), 0);
  assert.equal(fixture.storage.uploads, 0);
  assert.equal(fixture.repository.records.size, 0);
});

test('AI speech TTL must be a whole number from 30 through 3600 seconds', async () => {
  assert.doesNotThrow(() => setup('30'));
  assert.doesNotThrow(() => setup('3600'));
  for (const ttl of ['29', '3601', '30.5', 'invalid']) {
    assert.throws(() => setup(ttl), /whole number from 30 to 3600/);
  }
});
