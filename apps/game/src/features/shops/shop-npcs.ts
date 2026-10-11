import { SHOP_NPC_IDS } from '@life-abroad/shared';

export const SHOP_NPCS = [
  { id: 'npc_mia', name: 'Mia · Café seller', frame: 'cafe_seller' },
  { id: 'npc_cafe_waiter', name: 'Café waiter', frame: 'cafe_waiter' },
  { id: 'npc_cafe_customer', name: 'Café customer', frame: 'cafe_customer' },
  { id: 'npc_clothes_seller', name: 'Clothes seller', frame: 'clothes_seller' },
  { id: 'npc_clothes_assistant', name: 'Shop assistant', frame: 'clothes_assistant' },
  { id: 'npc_clothes_customer', name: 'Shop customer', frame: 'clothes_customer' },
] as const;
export type ShopNpcId = typeof SHOP_NPC_IDS[number];
export function isShopNpc(id: string): id is ShopNpcId {
  return SHOP_NPC_IDS.some(value => value === id);
}

