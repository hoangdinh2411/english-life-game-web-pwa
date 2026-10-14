import type { StreetNpcContent } from '@life-abroad/shared';
import { streetNpcContentSchema, TOWN_STREET_NPC_IDS } from '@life-abroad/shared';
import content from '../../../../../content/seed/street-npcs.json';

const catalog = streetNpcContentSchema.parse(content);

export const STREET_NPCS: readonly StreetNpcContent[] = catalog.npcs;
export const STREET_NPC_ROUTES = catalog.routes;

export type StreetNpcId = typeof TOWN_STREET_NPC_IDS[number];

export function findStreetNpc(id: string): StreetNpcContent | undefined {
  return STREET_NPCS.find((npc) => npc.id === id);
}

export function isStreetNpc(id: string): id is StreetNpcId {
  return STREET_NPCS.some((npc) => npc.id === id);
}
