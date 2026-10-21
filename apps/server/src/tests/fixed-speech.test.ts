import assert from 'node:assert/strict';
import test from 'node:test';
import { FixedSpeechService, speechCacheKey, type SpeechCacheIdentity } from '../modules/speech/fixed-speech.service';
import type { SpeechAudioStorage } from '../modules/speech/speech-audio.storage';
import type { SpeechCacheRecord, SpeechCacheRepository, SpeechCacheRecords } from '../modules/speech/speech-cache.repository';

const identity: SpeechCacheIdentity = {
  text: 'Could you repeat that?', language: 'en-US', voice: 'en-US-JennyNeural', style: 'cheerful',
  format: 'audio-24khz-48kbitrate-mono-mp3', ttsVersion: 'rest-v1', settings: {},
};

class MemoryRepository implements SpeechCacheRepository {
  readonly records = new Map<string, SpeechCacheRecord>();
  private readonly pending = new Map<string, Promise<void>>();

  async exclusive<T>(key: string, work: (records: SpeechCacheRecords) => Promise<T>): Promise<T> {
    const previous = this.pending.get(key) ?? Promise.resolve();
    let release: () => void = () => undefined;
    const current = new Promise<void>(resolve => { release = resolve; });
    const queued = previous.then(() => current);
    this.pending.set(key, queued);
    await previous;
    try { return await work(this); }
    finally { release(); if (this.pending.get(key) === queued) this.pending.delete(key); }
  }

  find(key: string): Promise<SpeechCacheRecord | undefined> { return Promise.resolve(this.records.get(key)); }
  save(record: SpeechCacheRecord): Promise<void> { this.records.set(record.cacheKey, record); return Promise.resolve(); }
}

class MemoryStorage implements SpeechAudioStorage {
  readonly files = new Map<string, Buffer>();
  uploads = 0;
  upload(path: string, audio: Buffer): Promise<void> { this.uploads += 1; this.files.set(path, audio); return Promise.resolve(); }
  remove(path: string): Promise<void> { this.files.delete(path); return Promise.resolve(); }
  signedUrl(path: string): Promise<string> { return Promise.resolve(`https://private.test/${path}?expires=60`); }
}

test('shared fixed lines and concurrent retries reuse one canonical file per voice', async () => {
  const repository = new MemoryRepository();
  const storage = new MemoryStorage();
  let generations = 0;
  const service = new FixedSpeechService(repository, storage, {
    synthesize: async () => { generations += 1; await Promise.resolve(); return Buffer.from('audio'); },
  });

  const [first, second] = await Promise.all([service.get(identity), service.get(identity)]);

  assert.equal(first.path, second.path);
  assert.equal(first.url, second.url);
  assert.equal(generations, 1);
  assert.equal(storage.uploads, 1);
  assert.equal(repository.records.size, 1);
  assert.ok(first.url.includes('?expires=60'));
});

test('NPC-specific text works and every generation input invalidates the canonical key', async () => {
  const base = speechCacheKey({ ...identity, mapId: 'ignored', npcId: 'ignored', speed: 0.8, pitch: 1.2 } as SpeechCacheIdentity);
  assert.equal(base, speechCacheKey(identity));
  assert.equal(base, speechCacheKey({ ...identity, settings: { speed: 0.8, pitch: 1.2 } } as SpeechCacheIdentity));
  const changes: SpeechCacheIdentity[] = [
    { ...identity, text: 'This line belongs to one NPC.' },
    { ...identity, language: 'en-GB' },
    { ...identity, voice: 'en-US-GuyNeural' },
    { ...identity, style: 'sad' },
    { ...identity, format: 'riff-24khz-16bit-mono-pcm' },
    { ...identity, ttsVersion: 'rest-v2' },
    { ...identity, settings: { effect: 'eq_car' } },
  ];
  assert.equal(new Set(changes.map(speechCacheKey)).size, changes.length);
  assert.ok(changes.every(value => speechCacheKey(value) !== base));

  const repository = new MemoryRepository();
  const storage = new MemoryStorage();
  const service = new FixedSpeechService(repository, storage, { synthesize: async input => Buffer.from(input.text) });
  const result = await service.get(changes[0]!);
  assert.equal(storage.files.get(result.path)?.toString(), 'This line belongs to one NPC.');
  const record = repository.records.get(result.cacheKey);
  assert.ok(record && !('text' in record));
});

test('a failed generation can retry without duplicate files or metadata', async () => {
  const repository = new MemoryRepository();
  const storage = new MemoryStorage();
  let attempts = 0;
  const service = new FixedSpeechService(repository, storage, {
    synthesize: async () => { attempts += 1; if (attempts === 1) throw new Error('provider unavailable'); return Buffer.from('audio'); },
  });

  await assert.rejects(service.get(identity), /provider unavailable/);
  const result = await service.get(identity);
  assert.equal(attempts, 2);
  assert.equal(storage.uploads, 1);
  assert.equal(repository.records.size, 1);
  assert.equal(repository.records.get(result.cacheKey)?.path, result.path);
});

test('retrying after signed-URL failure does not repeat generation or upload', async () => {
  const repository = new MemoryRepository();
  let signs = 0;
  const storage = new class extends MemoryStorage {
    override signedUrl(path: string): Promise<string> {
      signs += 1;
      return signs === 1 ? Promise.reject(new Error('signing unavailable')) : super.signedUrl(path);
    }
  }();
  let generations = 0;
  const service = new FixedSpeechService(repository, storage, {
    synthesize: async () => { generations += 1; return Buffer.from('audio'); },
  });

  await assert.rejects(service.get(identity), /signing unavailable/);
  const result = await service.get(identity);
  assert.ok(result.url.includes('?expires=60'));
  assert.equal(generations, 1);
  assert.equal(storage.uploads, 1);
  assert.equal(repository.records.size, 1);
});
