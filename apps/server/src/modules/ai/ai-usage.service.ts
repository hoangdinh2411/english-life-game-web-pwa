import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PoolClient } from 'pg';
import type { AiReplyResult } from './ai.service';

function positiveInteger(config: ConfigService, key: string): number | undefined {
  const raw = config.get<string>(key)?.trim();
  if (!raw) return undefined;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${key} must be a positive integer.`);
  return value;
}

@Injectable()
export class AiUsageService {
  private readonly dailyChats: number | undefined;
  private readonly dailyTokens: number | undefined;

  constructor(config: ConfigService) {
    this.dailyChats = positiveInteger(config, 'AI_DAILY_CHAT_LIMIT');
    this.dailyTokens = positiveInteger(config, 'AI_DAILY_TOKEN_LIMIT');
  }

  async limited(client: PoolClient, userId: string): Promise<boolean> {
    if (!this.dailyChats && !this.dailyTokens) return false;
    await client.query(`INSERT INTO public.ai_usage_daily (user_id,usage_date)
      VALUES ($1,current_date) ON CONFLICT (user_id,usage_date) DO NOTHING`, [userId]);
    const result = await client.query<{ tokens_used: number; free_chats_used: number }>(`SELECT tokens_used,free_chats_used
      FROM public.ai_usage_daily WHERE user_id=$1 AND usage_date=current_date FOR UPDATE`, [userId]);
    const row = result.rows[0]!;
    return this.dailyChats !== undefined && row.free_chats_used >= this.dailyChats
      || this.dailyTokens !== undefined && row.tokens_used >= this.dailyTokens;
  }

  async record(client: PoolClient, userId: string, conversationId: string, clientMessageId: string,
    result: AiReplyResult): Promise<void> {
    if (!result.usedProvider) return;
    const total = result.inputTokens + result.outputTokens;
    const inserted = await client.query<{ id: string }>(`INSERT INTO public.ai_usage
      (user_id,conversation_id,client_message_id,provider,model,input_tokens,output_tokens,total_tokens,estimated,fallback)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9)
      ON CONFLICT (conversation_id,client_message_id) DO NOTHING RETURNING id`,
    [userId, conversationId, clientMessageId, result.provider, result.model,
      result.inputTokens, result.outputTokens, total, result.fallback]);
    if (!inserted.rowCount) return;
    await client.query(`INSERT INTO public.ai_usage_daily (user_id,usage_date,tokens_used,free_chats_used)
      VALUES ($1,current_date,$2,1)
      ON CONFLICT (user_id,usage_date) DO UPDATE SET
        tokens_used=ai_usage_daily.tokens_used+excluded.tokens_used,
        free_chats_used=ai_usage_daily.free_chats_used+1`, [userId, total]);
  }
}
