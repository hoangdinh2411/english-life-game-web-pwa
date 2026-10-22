import type { Bounds, MapLocation, Point } from '../../types/gameplay/world';

export const TIME_BUCKETS = ['morning', 'daytime', 'evening'] as const;
export type TimeBucket = typeof TIME_BUCKETS[number];
export type VenueLocationId = Exclude<MapLocation, 'street'>;

export interface VenueNpcConfig {
  locationId: VenueLocationId;
  serviceNpcIds: readonly string[];
  optionalStaffNpcIds: readonly string[];
  ambientNpcPool: readonly string[];
  ambientCount: Readonly<{ min: number; max: number }>;
  spawnZoneIds: readonly string[];
  exclusionZoneIds: readonly string[];
  timeBuckets: readonly TimeBucket[];
}

export interface VenueNpcCatalog {
  locationIds: readonly VenueLocationId[];
  npcIds: readonly string[];
  spawnZones: Readonly<Record<string, Bounds>>;
  exclusionZones: Readonly<Record<string, Bounds>>;
}

export interface CountryLocalSeedInput {
  date: string;
  bucket: TimeBucket;
}

type Diagnostic = (message: string) => void;

// Missing or invalid clock/time-zone data must never introduce wall-clock randomness.
export const DETERMINISTIC_TIME_FALLBACK: CountryLocalSeedInput = {
  date: '2000-01-01',
  bucket: 'daytime',
};

function configError(locationId: unknown, field: string, detail: string): never {
  throw new Error(`Venue ${String(locationId)} field ${field}: ${detail}`);
}

function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

function assertKnownIds(locationId: unknown, field: string, values: readonly string[], knownValues: ReadonlySet<string>): void {
  if (hasDuplicates(values)) configError(locationId, field, 'contains duplicate IDs');
  const unknown = values.find(value => !knownValues.has(value));
  if (unknown) configError(locationId, field, `contains unknown ID ${unknown}`);
}

function usableZone(bounds: Bounds): boolean {
  return [bounds.left, bounds.right, bounds.top, bounds.bottom].every(Number.isFinite)
    && bounds.left < bounds.right
    && bounds.top < bounds.bottom;
}

export function validateVenueNpcConfig(config: VenueNpcConfig, catalog: VenueNpcCatalog): VenueNpcConfig {
  if (!new Set<string>(catalog.locationIds).has(config.locationId)) {
    configError(config.locationId, 'locationId', 'contains an unknown location ID');
  }
  const knownNpcs = new Set(catalog.npcIds);
  assertKnownIds(config.locationId, 'serviceNpcIds', config.serviceNpcIds, knownNpcs);
  assertKnownIds(config.locationId, 'optionalStaffNpcIds', config.optionalStaffNpcIds, knownNpcs);
  assertKnownIds(config.locationId, 'ambientNpcPool', config.ambientNpcPool, knownNpcs);
  assertKnownIds(config.locationId, 'spawnZoneIds', config.spawnZoneIds, new Set(Object.keys(catalog.spawnZones)));
  assertKnownIds(config.locationId, 'exclusionZoneIds', config.exclusionZoneIds, new Set(Object.keys(catalog.exclusionZones)));
  assertKnownIds(config.locationId, 'timeBuckets', config.timeBuckets, new Set(TIME_BUCKETS));

  const categorized = [...config.serviceNpcIds, ...config.optionalStaffNpcIds, ...config.ambientNpcPool];
  if (hasDuplicates(categorized)) configError(config.locationId, 'npc categories', 'assigns an NPC to conflicting categories');

  const { min, max } = config.ambientCount;
  if (!Number.isInteger(min) || min < 0) configError(config.locationId, 'ambientCount.min', 'must be a non-negative integer');
  if (!Number.isInteger(max) || max < min) configError(config.locationId, 'ambientCount.max', 'must be an integer greater than or equal to min');
  if (max > config.ambientNpcPool.length) configError(config.locationId, 'ambientCount.max', 'cannot exceed the ambient NPC pool size');
  if (config.timeBuckets.length === 0) configError(config.locationId, 'timeBuckets', 'must contain at least one bucket');
  if (config.ambientNpcPool.length > 0 && config.spawnZoneIds.length === 0) {
    configError(config.locationId, 'spawnZoneIds', 'must contain a zone when ambient NPCs are configured');
  }
  for (const zoneId of config.spawnZoneIds) {
    if (!usableZone(catalog.spawnZones[zoneId]!)) configError(config.locationId, 'spawnZoneIds', `zone ${zoneId} is unusable`);
  }
  for (const zoneId of config.exclusionZoneIds) {
    if (!usableZone(catalog.exclusionZones[zoneId]!)) configError(config.locationId, 'exclusionZoneIds', `zone ${zoneId} is unusable`);
  }
  return config;
}

function bucketForHour(hour: number): TimeBucket {
  if (hour >= 5 && hour < 10) return 'morning';
  if (hour >= 10 && hour < 17) return 'daytime';
  return 'evening';
}

export function countryLocalSeedInput(time: Date | null, timeZone: string | null): CountryLocalSeedInput {
  if (time === null || !Number.isFinite(time.getTime()) || !timeZone) return DETERMINISTIC_TIME_FALLBACK;
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
    }).formatToParts(time);
    const part = (type: Intl.DateTimeFormatPartTypes): string | undefined => parts.find(value => value.type === type)?.value;
    const year = part('year');
    const month = part('month');
    const day = part('day');
    const hour = Number(part('hour'));
    if (!year || !month || !day || !Number.isInteger(hour)) return DETERMINISTIC_TIME_FALLBACK;
    return { date: `${year}-${month}-${day}`, bucket: bucketForHour(hour) };
  } catch {
    return DETERMINISTIC_TIME_FALLBACK;
  }
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededOrder(values: readonly string[], seed: string): string[] {
  return [...values].sort((left, right) => {
    const difference = stableHash(`${seed}:${left}`) - stableHash(`${seed}:${right}`);
    return difference || left.localeCompare(right);
  });
}

export function activeNpcIds(
  config: VenueNpcConfig,
  time: Date | null,
  timeZone: string | null,
  availableAmbientNpcIds: readonly string[] = config.ambientNpcPool,
  diagnostic: Diagnostic = () => undefined,
): string[] {
  const local = countryLocalSeedInput(time, timeZone);
  const seed = `${local.date}:${config.locationId}:${local.bucket}`;
  const range = config.ambientCount.max - config.ambientCount.min + 1;
  const count = config.ambientCount.min + stableHash(`${seed}:count`) % range;
  const available = [...new Set(availableAmbientNpcIds)].filter(id => config.ambientNpcPool.includes(id));
  if (available.length < count) {
    diagnostic(`Ambient NPC pool undersized at ${config.locationId}: requested ${count}, available ${available.length}.`);
  }
  return [...config.serviceNpcIds, ...config.optionalStaffNpcIds, ...seededOrder(available, seed).slice(0, count)];
}

function contains(bounds: Bounds, point: Point): boolean {
  return point.x >= bounds.left && point.x <= bounds.right && point.y >= bounds.top && point.y <= bounds.bottom;
}

function clearsExclusion(bounds: Bounds, point: Point): boolean {
  const movementClearance = 40;
  return !contains({
    left: bounds.left - movementClearance,
    right: bounds.right + movementClearance,
    top: bounds.top - movementClearance,
    bottom: bounds.bottom + movementClearance,
  }, point);
}

function zoneCandidates(zone: Bounds): Point[] {
  const center = { x: (zone.left + zone.right) / 2, y: (zone.top + zone.bottom) / 2 };
  const horizontal = [0.25, 0.75].map(x => ({ x: zone.left + (zone.right - zone.left) * x, y: center.y }));
  const vertical = [0.25, 0.75].map(y => ({ x: center.x, y: zone.top + (zone.bottom - zone.top) * y }));
  return [center, ...horizontal, ...vertical];
}

export function ambientNpcSpawnPoints(
  config: VenueNpcConfig,
  spawnZones: Readonly<Record<string, Bounds>>,
  exclusionZones: Readonly<Record<string, Bounds>>,
  npcIds: readonly string[],
  diagnostic: Diagnostic = () => undefined,
): ReadonlyMap<string, Point> {
  const exclusions = config.exclusionZoneIds.map(id => exclusionZones[id]).filter((zone): zone is Bounds => zone !== undefined);
  const candidatesByZone = config.spawnZoneIds.flatMap(id => {
    const zone = spawnZones[id];
    return zone ? [zoneCandidates(zone)] : [];
  });
  const candidates = Array.from({ length: Math.max(0, ...candidatesByZone.map(points => points.length)) }, (_, index) =>
    candidatesByZone.flatMap(points => points[index] ? [points[index]] : []),
  ).flat().filter(point => exclusions.every(zone => clearsExclusion(zone, point)));
  const ambientIds = [...new Set(npcIds)].filter(id => config.ambientNpcPool.includes(id));
  if (candidates.length < ambientIds.length) {
    diagnostic(`Ambient NPC spawn capacity is insufficient at ${config.locationId}.`);
  }
  return new Map(ambientIds.slice(0, candidates.length).map((id, index) => [id, candidates[index]!]));
}
