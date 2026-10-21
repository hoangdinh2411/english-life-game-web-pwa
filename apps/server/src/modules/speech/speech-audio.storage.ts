import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

export interface SpeechAudioStorage {
  upload(path: string, audio: Buffer): Promise<void>;
  remove(path: string): Promise<void>;
  signedUrl(path: string): Promise<string>;
}

@Injectable()
export class SupabaseSpeechAudioStorage implements SpeechAudioStorage {
  constructor(private readonly config: ConfigService) {}

  private bucket() {
    const url = this.config.get<string>('SUPABASE_URL');
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) throw new ServiceUnavailableException('Speech storage is not configured.');
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
      .storage.from('speech-audio');
  }

  async upload(path: string, audio: Buffer): Promise<void> {
    const result = await this.bucket().upload(path, audio, { contentType: 'audio/mpeg', upsert: true });
    if (result.error) throw new ServiceUnavailableException('Speech storage upload failed.');
  }

  async remove(path: string): Promise<void> {
    const result = await this.bucket().remove([path]);
    if (result.error) throw new ServiceUnavailableException('Speech storage cleanup failed.');
  }

  async signedUrl(path: string): Promise<string> {
    const result = await this.bucket().createSignedUrl(path, 60);
    if (result.error || !result.data.signedUrl) throw new ServiceUnavailableException('Speech audio is unavailable.');
    return result.data.signedUrl;
  }
}
