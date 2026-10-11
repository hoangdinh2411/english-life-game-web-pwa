import { BadRequestException, ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { QuestContent } from '@life-abroad/shared';
import { PoolClient } from 'pg';

@Injectable()
export class EconomyService {
  constructor(private readonly database: DatabaseService, private readonly config: ConfigService) {}

  async grantStartingBalance(client: PoolClient, userId: string): Promise<void> {
    const amount = Number(this.config.get<string>('STARTING_BALANCE') ?? 500);
    if (!Number.isInteger(amount) || amount < 0 || amount > 2147483647) {
      throw new ServiceUnavailableException('Starting balance is invalid');
    }
    await client.query('SELECT user_id FROM public.player_stats WHERE user_id=$1 FOR UPDATE', [userId]);
    await client.query(`INSERT INTO public.wallet_ledger (user_id,amount,reason,reference,idempotency_key)
      VALUES ($1,$2,'starting_balance',$3,'starting_balance')`, [userId, amount, userId]);
    const result = await client.query('UPDATE public.player_stats SET coins=coins+$2 WHERE user_id=$1', [userId, amount]);
    if (result.rowCount !== 1) throw new ServiceUnavailableException('Player stats are unavailable');
  }

  // Server callers supply identity and an order reference; never expose this as a client charge endpoint.
  async spend(userId: string, amount: number, reason: string, key: string, reference: string = key): Promise<number> {
    if (!Number.isInteger(amount) || amount <= 0 || amount > 2147483647 ||
        !reason.trim() || !key.trim() || !reference.trim()) throw new BadRequestException('Invalid wallet charge');
    return this.database.transaction(async client => {
      const stats = await client.query<{ coins: number }>(
        'SELECT coins FROM public.player_stats WHERE user_id=$1 FOR UPDATE', [userId]);
      const balance = stats.rows[0]?.coins;
      if (balance === undefined) throw new ServiceUnavailableException('Player stats are unavailable');
      const previous = await client.query<{ amount: number; reason: string; reference: string }>(
        'SELECT amount,reason,reference FROM public.wallet_ledger WHERE user_id=$1 AND idempotency_key=$2', [userId, key]);
      const entry = previous.rows[0];
      if (entry) {
        if (entry.amount !== -amount || entry.reason !== reason || entry.reference !== reference) {
          throw new ConflictException('Wallet key already used for another operation');
        }
        return balance;
      }
      if (balance < amount) throw new ConflictException('Insufficient funds');
      await client.query(`INSERT INTO public.wallet_ledger (user_id,amount,reason,reference,idempotency_key)
        VALUES ($1,$2,$3,$4,$5)`, [userId, -amount, reason, reference, key]);
      await client.query('UPDATE public.player_stats SET coins=coins-$2 WHERE user_id=$1', [userId, amount]);
      return balance - amount;
    });
  }
  // The caller owns the transaction encompassing quest completion and reward.
  async grantQuestReward(client: PoolClient, userId: string, quest: QuestContent): Promise<void> {
    const claim = await client.query(`INSERT INTO public.quest_reward_claims (user_id,quest_id,xp,coins)
      VALUES ($1,$2,$3,$4) ON CONFLICT (user_id,quest_id) DO NOTHING RETURNING quest_id`,
    [userId, quest.id, quest.rewards.xp, quest.rewards.coins]);
    if (claim.rowCount === 0) return;
    const stats = await client.query(`UPDATE public.player_stats SET xp=xp+$2, coins=coins+$3 WHERE user_id=$1`,
      [userId, quest.rewards.xp, quest.rewards.coins]);
    if (stats.rowCount !== 1) throw new ServiceUnavailableException('Player stats are unavailable');
    await client.query(`INSERT INTO public.wallet_ledger (user_id,amount,reason,reference,idempotency_key)
      VALUES ($1,$2,'quest_reward',$3,$4)`, [userId, quest.rewards.coins, quest.id, `quest_reward:${quest.id}`]);
  }
}
