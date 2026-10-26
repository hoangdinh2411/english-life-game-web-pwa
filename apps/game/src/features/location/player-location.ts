import type { PlayerLocation } from '@life-abroad/shared';
import type { MapLocation } from '../../types/gameplay/world';

const PLACE_LOCATIONS: Record<PlayerLocation['placeId'], MapLocation> = {
  loc_station: 'station', loc_town_street: 'street', loc_cafe: 'cafe',
  loc_corner_cafe: 'corner_cafe', loc_clothes: 'clothes',
  loc_tax_office: 'tax_office',
};

const PLACE_IDS: Record<MapLocation, PlayerLocation['placeId']> = {
  station: 'loc_station', street: 'loc_town_street', cafe: 'loc_cafe',
  corner_cafe: 'loc_corner_cafe', clothes: 'loc_clothes',
  tax_office: 'loc_tax_office',
};

export function mapLocationFromPlayerLocation(location: PlayerLocation): MapLocation {
  return PLACE_LOCATIONS[location.placeId];
}

export function playerLocationFromMapLocation(location: MapLocation, position: { x: number; y: number }): PlayerLocation {
  return {
    mapId: location === 'street' || location === 'corner_cafe' || location === 'tax_office' ? 'loc_town_street' : 'loc_station',
    placeId: PLACE_IDS[location],
    x: position.x,
    y: position.y,
  };
}
