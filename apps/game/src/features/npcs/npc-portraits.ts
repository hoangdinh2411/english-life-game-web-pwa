export { npcPortraitPosition } from './npc-expression';
import type { MapPack } from '@life-abroad/shared';

const portraits = new Map<string, string>();

export function registerPackPortraits(pack: MapPack): void {
  for (const asset of pack.assets) {
    if (asset.npcId && asset.type === 'image' && asset.key === `portrait-${asset.npcId}`) {
      portraits.set(asset.npcId, asset.url);
    }
  }
}

export function npcPortrait(npcId: string): string {
  const portrait = portraits.get(npcId);
  if (!portrait) throw new Error(`${npcId} portrait has not loaded from Storage.`);
  return portrait;
}

export const NPC_PORTRAIT_GRID = { columns: 3, rows: 1 } as const;
