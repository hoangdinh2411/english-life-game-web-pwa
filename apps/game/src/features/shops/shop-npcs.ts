import { SHOP_NPC_IDS } from '@life-abroad/shared';

export const SHOP_NPCS = [
  { id: 'npc_mia', name: 'Mia · Café seller', frame: 'cafe_seller' },
  { id: 'npc_corner_cup_seller', name: 'Corner Cup seller', frame: 'cafe_seller' },
  { id: 'npc_cafe_waiter', name: 'Café waiter', frame: 'cafe_waiter' },
  { id: 'npc_cafe_customer', name: 'Café customer', frame: 'cafe_customer' },
  { id: 'npc_corner_cup_assistant', name: 'Corner Cup assistant', frame: 'cafe_waiter' },
  { id: 'npc_corner_cup_customer_1', name: 'Ava · Corner Cup customer', frame: 'cafe_customer' },
  { id: 'npc_corner_cup_customer_2', name: 'Leo · Corner Cup customer', frame: 'clothes_customer' },
  { id: 'npc_corner_cup_customer_3', name: 'Grace · Corner Cup customer', frame: 'cafe_customer' },
  { id: 'npc_clothes_seller', name: 'Clothes seller', frame: 'clothes_seller' },
  { id: 'npc_clothes_assistant', name: 'Shop assistant', frame: 'clothes_assistant' },
  { id: 'npc_clothes_customer', name: 'Shop customer', frame: 'clothes_customer' },
] as const;
export type ShopNpcId = typeof SHOP_NPC_IDS[number];
export function isShopNpc(id: string): id is ShopNpcId {
  return SHOP_NPC_IDS.some(value => value === id);
}

