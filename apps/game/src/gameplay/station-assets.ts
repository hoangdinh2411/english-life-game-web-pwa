import station from '../../assets/locations/location_station_map_labeled.png';
import player from '../../assets/runtime/player.png';
import femalePlayer from '../../assets/runtime/player-female-smooth.png';
import backpack from '../../assets/runtime/backpack.png';
import suitcase from '../../assets/runtime/suitcase.png';
import receptionist from '../../assets/runtime/receptionist.png';
import visitor from '../../assets/npcs/npc_cafe_customer/walk.png';
import playerAtlas from '../../assets/runtime/player.json';
import backpackAtlas from '../../assets/runtime/backpack.json';
import suitcaseAtlas from '../../assets/runtime/suitcase.json';
import receptionistAtlas from '../../assets/runtime/receptionist.json';
import type { PlayerGender } from '@life-abroad/shared';
import { NPC_FRAME_HEIGHT, NPC_FRAME_WIDTH, NPC_SHEET_COLUMNS, NPC_SHEET_ROWS } from '../features/npcs/actor-display';
import { PRACTICE_REMOTE_NPCS } from '../features/station/practice-assets';

function assetUrl(asset: unknown): string {
  if (typeof asset === 'string') return asset;
  if (typeof asset === 'object' && asset !== null && 'uri' in asset && typeof asset.uri === 'string') return asset.uri;
  throw new Error('Station image has no usable URL');
}
export const stationBackground = assetUrl(station);
export const stationAtlases = [
  { key: 'player', url: assetUrl(player), data: playerAtlas },
  { key: 'player-male', url: assetUrl(player), data: playerAtlas },
  { key: 'player-female', url: assetUrl(femalePlayer), data: playerAtlas },
  { key: 'backpack', url: assetUrl(backpack), data: backpackAtlas },
  { key: 'suitcase', url: assetUrl(suitcase), data: suitcaseAtlas },
  { key: 'receptionist', url: assetUrl(receptionist), data: receptionistAtlas },
  { key: 'visitor', url: assetUrl(visitor), data: {
    frames: Object.fromEntries(Array.from({ length: 16 }, (_, index) => {
      const row = Math.floor(index / 4), column = index % 4;
      return [`${row}-${column}`, { frame: { x: column * NPC_FRAME_WIDTH, y: row * NPC_FRAME_HEIGHT, w: NPC_FRAME_WIDTH, h: NPC_FRAME_HEIGHT }, rotated: false, trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: NPC_FRAME_WIDTH, h: NPC_FRAME_HEIGHT }, sourceSize: { w: NPC_FRAME_WIDTH, h: NPC_FRAME_HEIGHT } }];
    })),
    meta: { image: 'visitor.png', size: { w: NPC_FRAME_WIDTH * NPC_SHEET_COLUMNS, h: NPC_FRAME_HEIGHT * NPC_SHEET_ROWS }, scale: '1' },
  } },
];
const remotePracticeAtlasKeys = new Set<string>(PRACTICE_REMOTE_NPCS.map(npc => npc.assetKey));
export const practiceStationAtlases = stationAtlases.filter(atlas => !remotePracticeAtlasKeys.has(atlas.key));

export function savedPlayerAtlas(gender: PlayerGender) {
  const atlas = stationAtlases.find(candidate => candidate.key === `player-${gender}`);
  if (!atlas) throw new Error(`Player artwork is unavailable for ${gender}.`);
  return atlas;
}
