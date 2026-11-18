import { AIRPORT_NPC_IDS, npcCatalogSchema, type NpcContent } from '@life-abroad/shared';
import content from '../../../../../content/seed/npcs.json';
import type { VoiceGender } from '../../types/speech/narration';

const catalog = npcCatalogSchema.parse(content);

export type AirportStaffId = typeof AIRPORT_NPC_IDS[number];
export interface AirportStaff {
  id: AirportStaffId;
  name: string;
  job: 'Airport Staff';
  frame: 'walk';
  voice: VoiceGender;
  portrait: NonNullable<NpcContent['portrait']>;
}

export const AIRPORT_STAFF: readonly AirportStaff[] = AIRPORT_NPC_IDS.map(id => {
  const npc = catalog.find(candidate => candidate.id === id);
  if (!npc?.portrait || !npc.gender) throw new Error(`${id} is missing Airport staff content`);
  return { id, name: npc.name, job: 'Airport Staff', frame: 'walk', voice: npc.gender, portrait: npc.portrait };
});

export function isAirportStaff(id: string): id is AirportStaffId {
  return AIRPORT_NPC_IDS.some(value => value === id);
}
