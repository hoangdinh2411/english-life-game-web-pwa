import { SHOP_NPC_IDS } from '@life-abroad/shared';

export const SHOP_NPCS = [
  { id: 'npc_mia', name: 'Mia', frame: 'cafe_seller' },
  { id: 'npc_corner_cup_seller', name: 'Elena', frame: 'cafe_seller' },
  { id: 'npc_cafe_waiter', name: 'Daniel', frame: 'cafe_waiter' },
  { id: 'npc_cafe_customer', name: 'Olivia', frame: 'cafe_customer' },
  { id: 'npc_corner_cup_assistant', name: 'Samuel', frame: 'cafe_waiter' },
  { id: 'npc_corner_cup_customer_1', name: 'Ava', frame: 'cafe_customer' },
  { id: 'npc_corner_cup_customer_2', name: 'Leah', frame: 'clothes_customer' },
  { id: 'npc_corner_cup_customer_3', name: 'Grace', frame: 'cafe_customer' },
  { id: 'npc_clothes_seller', name: 'Ravi', frame: 'clothes_seller' },
  { id: 'npc_clothes_assistant', name: 'Alex', frame: 'clothes_assistant' },
  { id: 'npc_clothes_customer', name: 'Nora', frame: 'clothes_customer' },
] as const;
export type ShopNpcId = typeof SHOP_NPC_IDS[number];
export function isShopNpc(id: string): id is ShopNpcId {
  return SHOP_NPC_IDS.some(value => value === id);
}

