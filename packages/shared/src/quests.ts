import { z } from 'zod';

export const ARRIVAL_QUEST_ID = 'q_station_arrival';
export const ARRIVAL_NPC_ID = 'npc_receptionist';
export const STATION_LOCATION_ID = 'loc_station';
export const TOWN_STREET_LOCATION_ID = 'loc_town_street';

export const arrivalStateSchema = z.object({
  questId: z.literal(ARRIVAL_QUEST_ID),
  status: z.enum(['not_started', 'active', 'done']),
  currentStepId: z.string().nullable(),
  ticket: z.object({ issued: z.boolean(), used: z.boolean() }).strict(),
  canEnterTownStreet: z.boolean(),
  locationId: z.string(),
  rewardsGranted: z.boolean(),
}).strict();
export type ArrivalState = z.infer<typeof arrivalStateSchema>;
export const enterTownStreetSchema = z.object({}).strict();
