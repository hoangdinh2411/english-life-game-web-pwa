import { ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ARRIVAL_NPC_ID, ARRIVAL_QUEST_ID, ArrivalState, STATION_LOCATION_ID, TOWN_STREET_LOCATION_ID } from '@life-abroad/shared';
import { EconomyService } from '../economy/economy.service';
import { ArrivalProgress, ArrivalSnapshot, QuestsRepository } from './quests.repository';
import { PoolClient } from 'pg';

const orderedSteps = ['arrival_greet', 'arrival_ask', 'arrival_ticket', 'arrival_exit'] as const;

@Injectable()
export class QuestsService {
  constructor(private readonly quests: QuestsRepository, private readonly economy: EconomyService) {}

  getArrival(userId: string, client?: PoolClient): Promise<ArrivalState> {
    const read = async (connection: PoolClient) => this.state(await this.quests.load(connection, userId));
    return client ? read(client) : this.quests.transaction(read);
  }

  // Only trusted server dialogue orchestration calls this; there is no intent-write API.
  applyReceptionistIntent(userId: string, npcId: string, intent: string, client?: PoolClient): Promise<ArrivalState> {
    const recognized = ['greet', 'ask_town_directions', 'request_bus_ticket'].includes(intent);
    return this.advance(userId, npcId === ARRIVAL_NPC_ID && recognized ? intent : null, client);
  }

  issueArrivalTicket(userId: string, client?: PoolClient): Promise<ArrivalState> { return this.advance(userId, 'obtain_bus_ticket', client); }

  enterTownStreet(userId: string): Promise<ArrivalState> { return this.advance(userId, 'enter_town_street'); }

  private advance(userId: string, intent: string | null, connection?: PoolClient): Promise<ArrivalState> {
    const work = async (client: PoolClient): Promise<ArrivalState> => {
      const snapshot = await this.quests.load(client, userId);
      const { quest } = snapshot;
      this.validate(snapshot);
      const progress: ArrivalProgress = snapshot.progress ?? { status: 'not_started', current_step_id: orderedSteps[0],
        bus_ticket_issued_at: null, bus_ticket_used_at: null, rewards_granted_at: null };
      const stepIndex = quest.steps.findIndex(step => step.doneWhen.intent === intent || step.doneWhen.alternativeIntents?.includes(intent ?? ''));
      if (stepIndex < 0) return this.state(snapshot);
      if (progress.status === 'done') return this.state(snapshot);
      const currentIndex = progress.status === 'not_started' ? 0 : orderedSteps.findIndex(id => id === progress.current_step_id);
      if (currentIndex < 0) throw new ServiceUnavailableException('Arrival progress is invalid');
      if (stepIndex < currentIndex) return this.state(snapshot);
      if (stepIndex !== currentIndex) throw new ConflictException('Complete the arrival steps in order');
      if (snapshot.locationId !== STATION_LOCATION_ID) throw new ConflictException('Visit the station receptionist first');
      progress.status = 'active';
      progress.current_step_id = orderedSteps[stepIndex + 1] ?? null;
      if (intent === 'obtain_bus_ticket') progress.bus_ticket_issued_at = new Date();
      if (intent === 'enter_town_street') {
        if (!progress.bus_ticket_issued_at) throw new ConflictException('A bus ticket is required to enter Town Street');
        const destination = await client.query<{ city_id: string }>('SELECT city_id FROM public.locations WHERE id=$1', [TOWN_STREET_LOCATION_ID]);
        const station = await client.query<{ city_id: string }>('SELECT city_id FROM public.locations WHERE id=$1', [STATION_LOCATION_ID]);
        if (!destination.rows[0] || destination.rows[0].city_id !== station.rows[0]?.city_id) {
          throw new ServiceUnavailableException('Town Street content is unavailable');
        }
        progress.bus_ticket_used_at = new Date();
        progress.status = 'done';
        await this.economy.grantQuestReward(client, userId, quest);
        progress.rewards_granted_at = new Date();
        await client.query('UPDATE public.characters SET current_location_id=$2 WHERE user_id=$1', [userId, TOWN_STREET_LOCATION_ID]);
        snapshot.locationId = TOWN_STREET_LOCATION_ID;
      }
      await this.quests.save(client, userId, progress);
      return this.state({ ...snapshot, progress });
    };
    return connection ? work(connection) : this.quests.transaction(work);
  }

  private validate(snapshot: ArrivalSnapshot): void {
    if (snapshot.quest.npcId !== ARRIVAL_NPC_ID || snapshot.quest.steps.map(step => step.id).join(',') !== orderedSteps.join(',')) {
      throw new ServiceUnavailableException('Arrival quest content is invalid');
    }
  }

  private state(snapshot: ArrivalSnapshot): ArrivalState {
    this.validate(snapshot);
    const progress = snapshot.progress;
    return { questId: ARRIVAL_QUEST_ID, status: progress?.status ?? 'not_started',
      currentStepId: progress?.current_step_id ?? (progress?.status === 'done' ? null : orderedSteps[0]),
      ticket: { issued: !!progress?.bus_ticket_issued_at, used: !!progress?.bus_ticket_used_at },
      canEnterTownStreet: !!progress?.bus_ticket_issued_at && (progress.status === 'done' || progress.current_step_id === 'arrival_exit'),
      locationId: snapshot.locationId, rewardsGranted: !!progress?.rewards_granted_at };
  }
}
