import { ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ARRIVAL_QUEST_ID, QuestContent, questSchema, STATION_LOCATION_ID } from '@life-abroad/shared';
import { PoolClient } from 'pg';
import { DatabaseService } from '../../infrastructure/database/database.service';

export interface ArrivalProgress {
  status: 'not_started' | 'active' | 'done';
  current_step_id: string | null;
  bus_ticket_issued_at: Date | null;
  bus_ticket_used_at: Date | null;
  rewards_granted_at: Date | null;
}
export interface ArrivalSnapshot {
  quest: QuestContent;
  progress: ArrivalProgress | undefined;
  locationId: string;
}

@Injectable()
export class QuestsRepository {
  constructor(private readonly database: DatabaseService) {}

  transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> { return this.database.transaction(work); }

  async load(client: PoolClient, userId: string): Promise<ArrivalSnapshot> {
    // Every arrival operation locks the same existing character, including first requests.
    const character = await client.query<{ current_city_id: string; current_location_id: string | null }>(
      'SELECT current_city_id,current_location_id FROM public.characters WHERE user_id=$1 FOR UPDATE', [userId]);
    const player = character.rows[0];
    if (!player) throw new ConflictException('Create a character before starting the arrival quest');
    const content = await client.query<{ id: string; title: string; required_level: string; npc_id: string; rewards: unknown }>(
      'SELECT id,title,required_level,npc_id,rewards FROM public.quests WHERE id=$1', [ARRIVAL_QUEST_ID]);
    const quest = content.rows[0];
    if (!quest) throw new ServiceUnavailableException('Arrival quest content is unavailable');
    const steps = await client.query<{ id: string; description: string; done_when: unknown }>(
      'SELECT id,description,done_when FROM public.quest_steps WHERE quest_id=$1 ORDER BY step_order', [ARRIVAL_QUEST_ID]);
    const parsed = questSchema.safeParse({ id: quest.id, title: quest.title, requiredLevel: quest.required_level,
      npcId: quest.npc_id, rewards: quest.rewards,
      steps: steps.rows.map(step => ({ id: step.id, description: step.description, doneWhen: step.done_when })) });
    if (!parsed.success) throw new ServiceUnavailableException('Arrival quest content is invalid');
    const location = await client.query<{ city_id: string }>('SELECT city_id FROM public.locations WHERE id=$1', [STATION_LOCATION_ID]);
    if (location.rows[0]?.city_id !== player.current_city_id) throw new ConflictException('Character is not in the arrival city');
    const progress = await client.query<ArrivalProgress>(
      'SELECT status,current_step_id,bus_ticket_issued_at,bus_ticket_used_at,rewards_granted_at FROM public.player_quests WHERE user_id=$1 AND quest_id=$2 FOR UPDATE',
      [userId, ARRIVAL_QUEST_ID]);
    return { quest: parsed.data, progress: progress.rows[0], locationId: player.current_location_id ?? STATION_LOCATION_ID };
  }

  async save(client: PoolClient, userId: string, progress: ArrivalProgress): Promise<void> {
    await client.query(`INSERT INTO public.player_quests
      (user_id,quest_id,status,current_step_id,started_at,completed_at,rewards_granted_at,bus_ticket_issued_at,bus_ticket_used_at)
      VALUES ($1,$2,$3::public.quest_status,$4,now(),CASE WHEN $3::public.quest_status='done' THEN now() END,$5,$6,$7)
      ON CONFLICT (user_id,quest_id) DO UPDATE SET status=excluded.status,current_step_id=excluded.current_step_id,
      completed_at=excluded.completed_at,rewards_granted_at=excluded.rewards_granted_at,
      bus_ticket_issued_at=excluded.bus_ticket_issued_at,bus_ticket_used_at=excluded.bus_ticket_used_at`,
    [userId, ARRIVAL_QUEST_ID, progress.status, progress.current_step_id, progress.rewards_granted_at,
      progress.bus_ticket_issued_at, progress.bus_ticket_used_at]);
  }
}
