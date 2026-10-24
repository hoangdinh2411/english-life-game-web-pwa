import mia from '../../../assets/npcs/npc_mia/walk.png';
import cafeWaiter from '../../../assets/npcs/npc_cafe_waiter/walk.png';
import cornerSeller from '../../../assets/npcs/npc_corner_cup_seller/walk.png';
import cornerAssistant from '../../../assets/npcs/npc_corner_cup_assistant/walk.png';
import clothesSeller from '../../../assets/npcs/npc_clothes_seller/walk.png';
import clothesAssistant from '../../../assets/npcs/npc_clothes_assistant/walk.png';
import { NPC_FRAME_HEIGHT, NPC_FRAME_WIDTH, NPC_SHEET_COLUMNS, NPC_SHEET_ROWS } from '../npcs/actor-display';
import { isServiceNpc, type ServiceNpcId } from './shop-npcs';

function assetUrl(asset: unknown): string {
  if (typeof asset === 'string') return asset;
  if (typeof asset === 'object' && asset !== null && 'uri' in asset && typeof asset.uri === 'string') return asset.uri;
  throw new Error('Service NPC image has no usable URL');
}

function atlasData(image: string) {
  const frame = (column: number, row: number) => ({ frame: { x: column * NPC_FRAME_WIDTH, y: row * NPC_FRAME_HEIGHT, w: NPC_FRAME_WIDTH, h: NPC_FRAME_HEIGHT }, rotated: false, trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w: NPC_FRAME_WIDTH, h: NPC_FRAME_HEIGHT }, sourceSize: { w: NPC_FRAME_WIDTH, h: NPC_FRAME_HEIGHT } });
  return {
    frames: Object.fromEntries([
      ['walk', frame(0, 0)],
      ...Array.from({ length: 16 }, (_, index) => [`walk-${Math.floor(index / 4)}-${index % 4}`, frame(index % 4, Math.floor(index / 4))] as const),
    ]),
    meta: { image, size: { w: NPC_FRAME_WIDTH * NPC_SHEET_COLUMNS, h: NPC_FRAME_HEIGHT * NPC_SHEET_ROWS }, scale: '1' },
  };
}

const images: Record<ServiceNpcId, unknown> = {
  npc_mia: mia,
  npc_cafe_waiter: cafeWaiter,
  npc_corner_cup_seller: cornerSeller,
  npc_corner_cup_assistant: cornerAssistant,
  npc_clothes_seller: clothesSeller,
  npc_clothes_assistant: clothesAssistant,
};

export const bundledServiceAtlases = Object.entries(images).map(([id, image]) => ({
  id: id as ServiceNpcId,
  key: `service-${id}`,
  url: assetUrl(image),
  data: atlasData(`${id}.png`),
}));

export function bundledServiceTexture(npcId: string): string | undefined {
  return isServiceNpc(npcId) ? `service-${npcId}` : undefined;
}
