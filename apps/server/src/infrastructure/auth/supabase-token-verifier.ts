import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseTokenVerifier {
  private client?: SupabaseClient;

  constructor(private readonly config: ConfigService) {}

  async verify(token: string): Promise<string> {
    if (!this.client) {
      const url = this.config.get<string>('SUPABASE_URL');
      const key = this.config.get<string>('SUPABASE_PUBLISHABLE_KEY');
      if (!url || !key) throw new ServiceUnavailableException('Authentication is unavailable');
      this.client = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(5000) }) },
      });
    }
    try {
      // Auth validates the signature and expiry; never trust a decoded client JWT.
      const { data, error } = await this.client.auth.getUser(token);
      if (error || !data.user?.id) throw new UnauthorizedException();
      return data.user.id;
    } catch {
      // Fail closed without exposing tokens or upstream error details.
      throw new UnauthorizedException();
    }
  }
}
