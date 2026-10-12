import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { COFFEE_QUEST_ID, SELLER_NPC_ID, type CoffeeQuestState } from '@life-abroad/shared';
import { PoolClient } from 'pg';
import { EconomyService } from '../economy/economy.service';
import { QuestsRepository } from './quests.repository';
import { QuestsService } from './quests.service';

interface Progress { status: CoffeeQuestState['status']; current_step_id: string | null; rewards_granted_at: Date | null }
export type CoffeeEvent = 'greet' | 'order_drink' | 'pay_drink' | 'cancel_order';
const steps = ['coffee_greet', 'coffee_order', 'coffee_pay'] as const;

@Injectable()
export class CoffeeQuestService {
  constructor(private readonly quests: QuestsRepository, private readonly economy: EconomyService,
    private readonly arrival: QuestsService) {}

  get(userId: string, client?: PoolClient): Promise<CoffeeQuestState> {
    return client ? this.advance(client, userId) : this.quests.transaction(connection => this.advance(connection, userId));
  }

  // Called only by trusted dialogue orchestration inside the payment/message transaction.
  apply(client: PoolClient, userId: string, event: CoffeeEvent): Promise<CoffeeQuestState> {
    return this.advance(client, userId, event);
  }

  private async advance(client: PoolClient, userId: string, event?: CoffeeEvent): Promise<CoffeeQuestState> {
    const arrival = await this.arrival.getArrival(userId, client); // Shared character lock serializes first claims.
    const quest = await this.quests.content(client, COFFEE_QUEST_ID);
    if (quest.npcId !== SELLER_NPC_ID || quest.steps.map(step => step.id).join(',') !== steps.join(',')) {
      throw new ServiceUnavailableException('Coffee quest content is invalid');
    }
    const result = await client.query<Progress>(`SELECT status,current_step_id,rewards_granted_at
      FROM public.player_quests WHERE user_id=$1 AND quest_id=$2 FOR UPDATE`, [userId, COFFEE_QUEST_ID]);
    const progress = result.rows[0] ?? { status: 'not_started', current_step_id: steps[0], rewards_granted_at: null };
    const legacy: Record<string,string> = { s1: steps[0], s2: steps[1], s3: steps[1] };
    const current = progress.current_step_id;
    if (current && legacy[current]) progress.current_step_id = legacy[current]!;
    if (progress.status !== 'done' && !steps.some(id => id === progress.current_step_id)) throw new ServiceUnavailableException('Coffee quest progress is invalid');
    const available = arrival.status === 'done';
    let changed = false;
    if (available && progress.status !== 'done') {
      if (event === 'greet' && progress.current_step_id === steps[0]) {
        progress.status = 'active'; progress.current_step_id = steps[1]; changed = true;
      } else if (event === 'order_drink' && progress.current_step_id === steps[1]) {
        progress.current_step_id = steps[2]; changed = true;
      } else if (event === 'cancel_order' && progress.current_step_id === steps[2]) {
        progress.current_step_id = steps[1]; changed = true;
      } else if (event === 'pay_drink' && progress.current_step_id === steps[2]) {
        await this.economy.grantQuestReward(client, userId, quest);
        progress.status = 'done'; progress.current_step_id = null; progress.rewards_granted_at = new Date(); changed = true;
      }
    }
    if (changed) await client.query(`INSERT INTO public.player_quests
      (user_id,quest_id,status,current_step_id,started_at,completed_at,rewards_granted_at)
      VALUES ($1,$2,$3::public.quest_status,$4,now(),CASE WHEN $3='done' THEN now() END,$5)
      ON CONFLICT (user_id,quest_id) DO UPDATE SET status=excluded.status,current_step_id=excluded.current_step_id,
      completed_at=excluded.completed_at,rewards_granted_at=excluded.rewards_granted_at`,
    [userId, COFFEE_QUEST_ID, progress.status, progress.current_step_id, progress.rewards_granted_at]);
    return { questId: COFFEE_QUEST_ID, title: quest.title, status: progress.status,
      currentStepId: progress.current_step_id, objective: quest.steps.find(step => step.id === progress.current_step_id)?.description ?? null,
      available, rewardsGranted: !!progress.rewards_granted_at, rewards: quest.rewards };
  }
}
