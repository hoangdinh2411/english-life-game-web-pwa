export interface SpeechCacheRecord {
  cacheKey: string;
  path: string;
  bytes: number;
  language: string;
  voice: string;
  style: string;
  format: string;
  ttsVersion: string;
  settings: Readonly<{ effect?: string }>;
}

export interface SpeechCacheRecords {
  find(key: string): Promise<SpeechCacheRecord | undefined>;
  save(record: SpeechCacheRecord): Promise<void>;
}

export interface SpeechCacheRepository {
  exclusive<T>(key: string, work: (records: SpeechCacheRecords) => Promise<T>): Promise<T>;
}
import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../infrastructure/database/database.service';


interface SpeechCacheRow {
  cache_key: string;
  storage_path: string;
  bytes: number;
  language: string;
  voice: string;
  style: string;
  format: string;
  tts_version: string;
  settings: { effect?: string };
}

function records(client: PoolClient): SpeechCacheRecords {
  return {
    async find(key) {
      const row = (await client.query<SpeechCacheRow>(`SELECT cache_key,storage_path,bytes,language,voice,style,
        format,tts_version,settings FROM speech_audio_cache WHERE cache_key=$1`, [key])).rows[0];
      return row ? { cacheKey: row.cache_key, path: row.storage_path, bytes: row.bytes, language: row.language,
        voice: row.voice, style: row.style, format: row.format, ttsVersion: row.tts_version, settings: row.settings } : undefined;
    },
    async save(record) {
      await client.query(`INSERT INTO speech_audio_cache
        (cache_key,storage_path,bytes,language,voice,style,format,tts_version,settings)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [record.cacheKey, record.path, record.bytes, record.language,
        record.voice, record.style, record.format, record.ttsVersion, JSON.stringify(record.settings)]);
    },
  };
}

@Injectable()
export class PostgresSpeechCacheRepository implements SpeechCacheRepository {
  constructor(private readonly database: DatabaseService) {}

  exclusive<T>(key: string, work: (cache: SpeechCacheRecords) => Promise<T>): Promise<T> {
    return this.database.transaction(async client => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`speech:${key}`]);
      return work(records(client));
    });
  }
}
