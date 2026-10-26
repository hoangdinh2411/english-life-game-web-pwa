import { npcCatalogSchema, TAX_OFFICE_NPC_IDS, type NpcContent } from '@life-abroad/shared';
import content from '../../../../../content/seed/npcs.json';
import type { VoiceGender } from '../../types/speech/narration';

const catalog = npcCatalogSchema.parse(content);

export type TaxOfficeStaffId = typeof TAX_OFFICE_NPC_IDS[number];
export interface TaxOfficeStaff {
  id: TaxOfficeStaffId;
  name: string;
  job: 'Tax Office Staff';
  frame: 'walk';
  voice: VoiceGender;
  portrait: NonNullable<NpcContent['portrait']>;
}

export const TAX_OFFICE_STAFF: readonly TaxOfficeStaff[] = TAX_OFFICE_NPC_IDS.map(id => {
  const npc = catalog.find(candidate => candidate.id === id);
  if (!npc?.portrait || !npc.gender) throw new Error(`${id} is missing Tax Office staff content`);
  return { id, name: npc.name, job: 'Tax Office Staff', frame: 'walk', voice: npc.gender, portrait: npc.portrait };
});

export function isTaxOfficeStaff(id: string): id is TaxOfficeStaffId {
  return TAX_OFFICE_NPC_IDS.some(value => value === id);
}
