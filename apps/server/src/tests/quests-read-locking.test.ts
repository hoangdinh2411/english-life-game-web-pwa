import assert from 'node:assert/strict';
import test from 'node:test';
import type { PoolClient } from 'pg';
import type { DatabaseService } from '../infrastructure/database/database.service';
import { QuestsRepository } from '../modules/quests/quests.repository';

const steps = [
  { id: 'arrival_greet', intent: 'greet' },
  { id: 'arrival_ask', intent: 'ask_town_directions', alternativeIntents: ['request_bus_ticket'] },
  { id: 'arrival_ticket', intent: 'obtain_bus_ticket' },
  { id: 'arrival_exit', intent: 'enter_town_street' },
] as const;

function fixture() {
  const queries: string[] = [];
  const client = { query: async (sql: string) => {
    queries.push(sql);
    if (sql.includes('FROM public.characters')) return { rows: [{ current_city_id: 'city_stockholm', current_location_id: 'loc_station' }] };
    if (sql.includes('FROM public.quests')) return { rows: [{ id: 'q_station_arrival', title: 'Arrival', required_level: 'A1',
      npc_id: 'npc_receptionist', rewards: { xp: 20, coins: 5 } }] };
    if (sql.includes('FROM public.quest_steps')) return { rows: steps.map(step => ({ id: step.id, description: step.id,
      done_when: { intent: step.intent, ...('alternativeIntents' in step ? { alternativeIntents: step.alternativeIntents } : {}) } })) };
    if (sql.includes('FROM public.locations')) return { rows: [{ city_id: 'city_stockholm' }] };
    if (sql.includes('FROM public.player_quests')) return { rows: [] };
    throw new Error(`Unexpected query: ${sql}`);
  } } as unknown as PoolClient;
  const database = { transaction: <T>(work: (connection: PoolClient) => Promise<T>) => work(client) } as DatabaseService;
  return { repository: new QuestsRepository(database), client, queries };
}

test('arrival reads do not wait on gameplay row locks', async () => {
  const setup = fixture();
  await setup.repository.load(setup.client, 'user-1');
  assert.equal(setup.queries.some(sql => sql.includes('FOR UPDATE')), false);
});

test('arrival mutations still lock character and progress rows', async () => {
  const setup = fixture();
  await setup.repository.load(setup.client, 'user-1', true);
  assert.equal(setup.queries.filter(sql => sql.includes('FOR UPDATE')).length, 2);
});
