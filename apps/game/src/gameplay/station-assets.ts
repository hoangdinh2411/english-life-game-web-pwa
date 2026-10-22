import station from '../../assets/locations/location_station_map_labeled.png';
import player from '../../assets/runtime/player.png';
import backpack from '../../assets/runtime/backpack.png';
import suitcase from '../../assets/runtime/suitcase.png';
import receptionist from '../../assets/runtime/receptionist.png';
import visitor from '../../assets/npcs/npc_cafe_customer/walk.png';
import playerAtlas from '../../assets/runtime/player.json';
import backpackAtlas from '../../assets/runtime/backpack.json';
import suitcaseAtlas from '../../assets/runtime/suitcase.json';
import receptionistAtlas from '../../assets/runtime/receptionist.json';

function assetUrl(asset: unknown): string {
  if (typeof asset === 'string') return asset;
  if (typeof asset === 'object' && asset !== null && 'uri' in asset && typeof asset.uri === 'string') return asset.uri;
  throw new Error('Station image has no usable URL');
}
export const stationBackground = assetUrl(station);
export const stationAtlases = [
  { key: 'player', url: assetUrl(player), data: playerAtlas },
  { key: 'backpack', url: assetUrl(backpack), data: backpackAtlas },
  { key: 'suitcase', url: assetUrl(suitcase), data: suitcaseAtlas },
  { key: 'receptionist', url: assetUrl(receptionist), data: receptionistAtlas },
  { key: 'visitor', url: assetUrl(visitor), data: {
    frames: Object.fromEntries(Array.from({ length: 16 }, (_, index) => {
      const row = Math.floor(index / 4), column = index % 4;
      return [`${row}-${column}`, { frame: { x: column * 96, y: row * 171, w: 96, h: 171 }, rotated: false, trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: 96, h: 171 }, sourceSize: { w: 96, h: 171 } }];
    })),
    meta: { image: 'visitor.png', size: { w: 384, h: 684 }, scale: '1' },
  } },
];
