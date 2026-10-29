import type { MapAsset, MapPack } from '@life-abroad/shared';

export const PRACTICE_REMOTE_NPCS = [
  { id: 'npc_passenger_backpack', name: 'Sofia', assetKey: 'backpack' },
  { id: 'npc_passenger_suitcase', name: 'Elias', assetKey: 'suitcase' },
  { id: 'npc_passenger_visitor', name: 'Ingrid', assetKey: 'visitor' },
] as const;

export type PracticeRemoteNpc = typeof PRACTICE_REMOTE_NPCS[number];

export interface PracticeNpcAssets {
  image: MapAsset;
  atlas: MapAsset;
  portrait: MapAsset;
}

export function practiceNpcAssets(pack: MapPack, npc: PracticeRemoteNpc): PracticeNpcAssets {
  if (pack.mapId !== 'loc_station') throw new Error(`${npc.name} requires the Train Station asset pack.`);
  const image = pack.assets.find(asset => asset.key === npc.assetKey && asset.type === 'image' && asset.npcId === null);
  const atlas = pack.assets.find(asset => asset.key === `${npc.assetKey}-atlas` && asset.type === 'json' && asset.npcId === null);
  const portrait = pack.assets.find(asset => asset.key === `${npc.assetKey}-portrait` && asset.type === 'image' && asset.npcId === null);
  if (!image || !atlas || !portrait) throw new Error(`${npc.name}’s Storage artwork is incomplete.`);
  return { image, atlas, portrait };
}
