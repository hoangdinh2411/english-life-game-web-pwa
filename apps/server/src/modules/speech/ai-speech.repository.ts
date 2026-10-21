export interface PersistedAiMessage { text: string }

export interface AiSpeechCacheRecord {
  cacheKey: string;
  path: string;
  bytes: number;
  expiresAt: Date;
}

export interface AiSpeechCacheRecords {
  find(key: string): Promise<AiSpeechCacheRecord | undefined>;
  save(record: AiSpeechCacheRecord): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface AiSpeechRepository {
  message(userId: string, messageId: string): Promise<PersistedAiMessage | undefined>;
  expired(limit: number): Promise<AiSpeechCacheRecord[]>;
  exclusive<T>(key: string, work: (records: AiSpeechCacheRecords) => Promise<T>): Promise<T>;
}
import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../infrastructure/database/database.service';


interface AiSpeechRow { cache_key: string; storage_path: string; bytes: number; expires_at: Date }

function cacheRecords(client: PoolClient): AiSpeechCacheRecords {
  return {
    async find(key) {
      const row = (await client.query<AiSpeechRow>(
        'SELECT cache_key,storage_path,bytes,expires_at FROM ai_speech_audio_cache WHERE cache_key=$1', [key])).rows[0];
      return row ? { cacheKey: row.cache_key, path: row.storage_path, bytes: row.bytes, expiresAt: row.expires_at } : undefined;
    },
    async save(record) {
      await client.query(`INSERT INTO ai_speech_audio_cache(cache_key,storage_path,bytes,expires_at)
        VALUES($1,$2,$3,$4)`, [record.cacheKey, record.path, record.bytes, record.expiresAt]);
    },
    async remove(key) { await client.query('DELETE FROM ai_speech_audio_cache WHERE cache_key=$1', [key]); },
  };
}

@Injectable()
export class PostgresAiSpeechRepository implements AiSpeechRepository {
  constructor(private readonly database: DatabaseService) {}

  async message(userId: string, messageId: string): Promise<PersistedAiMessage | undefined> {
    const result = await this.database.query<PersistedAiMessage>(`SELECT m.text FROM messages m
      JOIN conversations c ON c.id=m.conversation_id
      WHERE m.id=$1 AND c.user_id=$2 AND m.sender='npc' AND m.metadata->>'ai'='true'`, [messageId, userId]);
    return result.rows[0];
  }

  async expired(limit: number): Promise<AiSpeechCacheRecord[]> {
    const result = await this.database.query<AiSpeechRow>(`SELECT cache_key,storage_path,bytes,expires_at
      FROM ai_speech_audio_cache WHERE expires_at<=now() ORDER BY expires_at LIMIT $1`, [limit]);
    return result.rows.map(row => ({ cacheKey: row.cache_key, path: row.storage_path,
      bytes: row.bytes, expiresAt: row.expires_at }));
  }

  exclusive<T>(key: string, work: (records: AiSpeechCacheRecords) => Promise<T>): Promise<T> {
    return this.database.transaction(async client => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`ai-speech:${key}`]);
      return work(cacheRecords(client));
    });
  }
}
