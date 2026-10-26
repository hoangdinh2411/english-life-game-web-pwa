import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

export interface IdCardPhotoStorage {
  upload(path: string, image: Buffer): Promise<void>;
  remove(path: string): Promise<void>;
  signedUrl(path: string): Promise<string>;
}

@Injectable()
export class SupabaseIdCardPhotoStorage implements IdCardPhotoStorage {
  constructor(private readonly config: ConfigService) {}

  private bucket() {
    const url = this.config.get<string>('SUPABASE_URL');
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) throw new ServiceUnavailableException('ID card photo storage is not configured.');
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
      .storage.from('id-card-photos');
  }

  async upload(path: string, image: Buffer): Promise<void> {
    const result = await this.bucket().upload(path, image, { contentType: 'image/jpeg', cacheControl: '0', upsert: true });
    if (result.error) throw new ServiceUnavailableException('ID card photo upload failed.');
  }

  async remove(path: string): Promise<void> {
    const result = await this.bucket().remove([path]);
    if (result.error) throw new ServiceUnavailableException('ID card photo cleanup failed.');
  }

  async signedUrl(path: string): Promise<string> {
    const result = await this.bucket().createSignedUrl(path, 60);
    if (result.error || !result.data.signedUrl) throw new ServiceUnavailableException('ID card photo is unavailable.');
    return result.data.signedUrl;
  }
}

