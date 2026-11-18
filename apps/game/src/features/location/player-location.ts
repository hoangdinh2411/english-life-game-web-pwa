import type { PlayerLocation } from '@life-abroad/shared';
import type { MapLocation } from '../../types/gameplay/world';

const PLACE_LOCATIONS: Record<PlayerLocation['placeId'], MapLocation> = {
  loc_station: 'station', loc_town_street: 'street', loc_cafe: 'cafe',
  loc_corner_cafe: 'corner_cafe', loc_clothes: 'clothes',
  loc_tax_office: 'tax_office',
  loc_airport_departure: 'airport_departure',
  loc_airport_arrival: 'airport_arrival',
};

const PLACE_IDS: Record<MapLocation, PlayerLocation['placeId']> = {
  station: 'loc_station', street: 'loc_town_street', cafe: 'loc_cafe',
  corner_cafe: 'loc_corner_cafe', clothes: 'loc_clothes',
  tax_office: 'loc_tax_office',
  airport_departure: 'loc_airport_departure',
  airport_arrival: 'loc_airport_arrival',
};

export function mapLocationFromPlayerLocation(location: PlayerLocation): MapLocation {
  return PLACE_LOCATIONS[location.placeId];
}

function mapIdFromMapLocation(location: MapLocation): PlayerLocation['mapId'] {
  if (location === 'airport_departure') return 'loc_airport_departure';
  if (location === 'airport_arrival') return 'loc_airport_arrival';
  return location === 'street' || location === 'corner_cafe' || location === 'tax_office' ? 'loc_town_street' : 'loc_station';
}

export function playerLocationFromMapLocation(location: MapLocation, position: { x: number; y: number }): PlayerLocation {
  return {
    mapId: mapIdFromMapLocation(location),
    placeId: PLACE_IDS[location],
    x: position.x,
    y: position.y,
  };
}
