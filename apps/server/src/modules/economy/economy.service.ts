import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { QuestContent } from '@life-abroad/shared';
import { PoolClient } from 'pg';

@Injectable()
export class EconomyService {
  // The caller owns the transaction encompassing quest completion and reward.
  async grantQuestReward(client: PoolClient, userId: string, quest: QuestContent): Promise<void> {
    const claim = await client.query(`INSERT INTO public.quest_reward_claims (user_id,quest_id,xp,coins)
      VALUES ($1,$2,$3,$4) ON CONFLICT (user_id,quest_id) DO NOTHING RETURNING quest_id`,
    [userId, quest.id, quest.rewards.xp, quest.rewards.coins]);
    if (claim.rowCount === 0) return;
    const stats = await client.query(`UPDATE public.player_stats SET xp=xp+$2, coins=coins+$3 WHERE user_id=$1`,
      [userId, quest.rewards.xp, quest.rewards.coins]);
    if (stats.rowCount !== 1) throw new ServiceUnavailableException('Player stats are unavailable');
  }
}
