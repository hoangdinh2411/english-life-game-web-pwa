import type { Bounds, MapLocation } from '../../types/gameplay/world';
import { validateVenueNpcConfig, type VenueNpcCatalog, type VenueNpcConfig } from '../npcs/controlled-presence';
import { STATION_ROSTER } from '../station/station-roster';
import { SHOP_NPCS } from './shop-npcs';

export const VENUE_SPAWN_ZONES = {
  station_passengers_left: { left: 560, right: 640, top: 350, bottom: 420 },
  station_passengers_right: { left: 910, right: 990, top: 350, bottom: 420 },
  station_passengers_south: { left: 570, right: 650, top: 660, bottom: 740 },
  cafe_customers: { left: 390, right: 470, top: 560, bottom: 640 },
  corner_cafe_customers: { left: 390, right: 1120, top: 560, bottom: 790 },
  clothes_customers: { left: 930, right: 1010, top: 650, bottom: 730 },
} as const satisfies Readonly<Record<string, Bounds>>;

export const VENUE_EXCLUSION_ZONES = {
  station_desk: { left: 670, right: 900, top: 420, bottom: 680 },
  cafe_entrance: { left: 650, right: 890, top: 790, bottom: 1024 },
  corner_cafe_entrance: { left: 650, right: 890, top: 790, bottom: 1024 },
  clothes_entrance: { left: 650, right: 890, top: 790, bottom: 1024 },
} as const satisfies Readonly<Record<string, Bounds>>;

const catalog = {
  locationIds: ['station', 'cafe', 'corner_cafe', 'clothes'],
  npcIds: [...STATION_ROSTER.map(npc => npc.id), ...SHOP_NPCS.map(npc => npc.id)],
  spawnZones: VENUE_SPAWN_ZONES,
  exclusionZones: VENUE_EXCLUSION_ZONES,
} as const satisfies VenueNpcCatalog;

const configs = [
  { locationId: 'station', serviceNpcIds: ['npc_station_information'], optionalStaffNpcIds: [], ambientNpcPool: ['npc_passenger_backpack', 'npc_passenger_suitcase', 'npc_passenger_visitor'], ambientCount: { min: 1, max: 2 }, spawnZoneIds: ['station_passengers_left', 'station_passengers_right', 'station_passengers_south'], exclusionZoneIds: ['station_desk'], timeBuckets: ['morning', 'daytime', 'evening'] },
  { locationId: 'cafe', serviceNpcIds: ['npc_mia', 'npc_cafe_waiter'], optionalStaffNpcIds: [], ambientNpcPool: ['npc_cafe_customer'], ambientCount: { min: 0, max: 1 }, spawnZoneIds: ['cafe_customers'], exclusionZoneIds: ['cafe_entrance'], timeBuckets: ['morning', 'daytime', 'evening'] },
  { locationId: 'corner_cafe', serviceNpcIds: ['npc_corner_cup_seller', 'npc_corner_cup_assistant'], optionalStaffNpcIds: [], ambientNpcPool: ['npc_corner_cup_customer_1', 'npc_corner_cup_customer_2', 'npc_corner_cup_customer_3'], ambientCount: { min: 1, max: 2 }, spawnZoneIds: ['corner_cafe_customers'], exclusionZoneIds: ['corner_cafe_entrance'], timeBuckets: ['morning', 'daytime', 'evening'] },
  { locationId: 'clothes', serviceNpcIds: ['npc_clothes_seller', 'npc_clothes_assistant'], optionalStaffNpcIds: [], ambientNpcPool: ['npc_clothes_customer'], ambientCount: { min: 0, max: 1 }, spawnZoneIds: ['clothes_customers'], exclusionZoneIds: ['clothes_entrance'], timeBuckets: ['morning', 'daytime', 'evening'] },
] as const satisfies readonly VenueNpcConfig[];

const registry = new Map(configs.map(config => [config.locationId, validateVenueNpcConfig(config, catalog)]));

export function venueNpcConfig(location: Exclude<MapLocation, 'street'>): VenueNpcConfig {
  const config = registry.get(location);
  if (!config) throw new Error(`Venue ${location} field locationId: no NPC configuration is registered`);
  return config;
}

const locationByMapId = {
  loc_station: 'station',
  loc_cafe: 'cafe',
  loc_corner_cafe: 'corner_cafe',
  loc_clothes: 'clothes',
} as const satisfies Readonly<Record<string, Exclude<MapLocation, 'street'>>>;

export function venueNpcConfigForMapId(mapId: string): VenueNpcConfig | undefined {
  const location = locationByMapId[mapId as keyof typeof locationByMapId];
  return location ? venueNpcConfig(location) : undefined;
}
