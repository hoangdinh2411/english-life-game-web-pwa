import station from '../../assets/locations/location_station_map_labeled.png';
import cafeMap from '../../assets/locations/location_cafe_interior.png';
import clothesMap from '../../assets/locations/location_clothes_interior.png';
import townStreetMap from '../../assets/locations/location_maplewood_street.png';
import player from '../../assets/runtime/player.png';
import backpack from '../../assets/runtime/backpack.png';
import suitcase from '../../assets/runtime/suitcase.png';
import receptionist from '../../assets/runtime/receptionist.png';
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
export const destinationMaps = { cafe: assetUrl(cafeMap), clothes: assetUrl(clothesMap), street: assetUrl(townStreetMap) };
export const stationAtlases = [
  { key: 'player', url: assetUrl(player), data: playerAtlas },
  { key: 'backpack', url: assetUrl(backpack), data: backpackAtlas },
  { key: 'suitcase', url: assetUrl(suitcase), data: suitcaseAtlas },
  { key: 'receptionist', url: assetUrl(receptionist), data: receptionistAtlas },
];
