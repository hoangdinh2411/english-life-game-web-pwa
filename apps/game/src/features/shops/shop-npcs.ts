import { npcCatalogSchema, SHOP_NPC_IDS, type NpcContent } from '@life-abroad/shared';
import content from '../../../../../content/seed/npcs.json';

const npcCatalog = npcCatalogSchema.parse(content);

function portraitFor(id: string): NonNullable<NpcContent['portrait']> {
  const portrait = npcCatalog.find(npc => npc.id === id)?.portrait;
  if (!portrait) throw new Error(`${id} is missing portrait data`);
  return portrait;
}

export const SHOP_NPCS = [
  { id: 'npc_mia', name: 'Mia', frame: 'walk', portrait: portraitFor('npc_mia') },
  { id: 'npc_corner_cup_seller', name: 'Elena', frame: 'walk', portrait: portraitFor('npc_corner_cup_seller') },
  { id: 'npc_cafe_waiter', name: 'Daniel', frame: 'walk', portrait: portraitFor('npc_cafe_waiter') },
  { id: 'npc_cafe_customer', name: 'Olivia', frame: 'walk', portrait: portraitFor('npc_cafe_customer') },
  { id: 'npc_corner_cup_assistant', name: 'Samuel', frame: 'walk', portrait: portraitFor('npc_corner_cup_assistant') },
  { id: 'npc_corner_cup_customer_1', name: 'Ava', frame: 'walk', portrait: portraitFor('npc_corner_cup_customer_1') },
  { id: 'npc_corner_cup_customer_2', name: 'Leah', frame: 'walk', portrait: portraitFor('npc_corner_cup_customer_2') },
  { id: 'npc_corner_cup_customer_3', name: 'Grace', frame: 'walk', portrait: portraitFor('npc_corner_cup_customer_3') },
  { id: 'npc_clothes_seller', name: 'Ravi', frame: 'walk', portrait: portraitFor('npc_clothes_seller') },
  { id: 'npc_clothes_assistant', name: 'Alex', frame: 'walk', portrait: portraitFor('npc_clothes_assistant') },
  { id: 'npc_clothes_customer', name: 'Nora', frame: 'walk', portrait: portraitFor('npc_clothes_customer') },
] as const;
export const SERVICE_NPC_IDS = [
  'npc_mia', 'npc_cafe_waiter',
  'npc_corner_cup_seller', 'npc_corner_cup_assistant',
  'npc_clothes_seller', 'npc_clothes_assistant',
] as const;
export type ServiceNpcId = typeof SERVICE_NPC_IDS[number];
export function isServiceNpc(id: string): id is ServiceNpcId {
  return SERVICE_NPC_IDS.some(value => value === id);
}
export type ShopNpcId = typeof SHOP_NPC_IDS[number];
export function isShopNpc(id: string): id is ShopNpcId {
  return SHOP_NPC_IDS.some(value => value === id);
}

