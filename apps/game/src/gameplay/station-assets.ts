import station from '../../assets/locations/location_station_map_labeled.png';
import player from '../../assets/runtime/player.png';
import femalePlayer from '../../assets/runtime/player-female-smooth.png';
import receptionist from '../../assets/runtime/receptionist.png';
import playerAtlas from '../../assets/runtime/player.json';
import receptionistAtlas from '../../assets/runtime/receptionist.json';
import type { PlayerGender } from '@life-abroad/shared';

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
  { key: 'receptionist', url: assetUrl(receptionist), data: receptionistAtlas },
];
export const practiceStationAtlases = stationAtlases;

export function savedPlayerAtlas(gender: PlayerGender) {
  const atlas = stationAtlases.find(candidate => candidate.key === `player-${gender}`);
  if (!atlas) throw new Error(`Player artwork is unavailable for ${gender}.`);
  return atlas;
}
