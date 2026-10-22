import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activeNpcIds,
  countryLocalSeedInput,
  validateVenueNpcConfig,
} from '../src/features/npcs/controlled-presence.ts';
import { venueNpcConfig } from '../src/features/shops/venue-npc-config.ts';

const at = (day, hour) => new Date(Date.UTC(2026, 9, day, hour));
const sweden = 'Europe/Stockholm';

test('controlled presence is stable for identical country-local seed inputs', () => {
  const config = venueNpcConfig('station');
  const first = activeNpcIds(config, at(21, 8), sweden);
  const second = activeNpcIds(config, at(21, 8), sweden);
  assert.deepEqual(first, second);
  assert.equal(new Set(first).size, first.length);
  assert.ok(first.includes('npc_station_information'));
  assert.ok(first.length >= 2 && first.length <= 3);
});

test('country-local date and bucket drive the seed instead of UTC date and hour', () => {
  assert.deepEqual(countryLocalSeedInput(new Date('2026-10-21T22:30:00.000Z'), sweden), {
    date: '2026-10-22', bucket: 'evening',
  });
  assert.deepEqual(countryLocalSeedInput(new Date('2026-10-21T08:30:00.000Z'), sweden), {
    date: '2026-10-21', bucket: 'daytime',
  });
  assert.deepEqual(countryLocalSeedInput(new Date('2026-10-21T03:30:00.000Z'), sweden), {
    date: '2026-10-21', bucket: 'morning',
  });
});

test('date or bucket changes can produce a different valid roster and bounds always hold', () => {
  const config = venueNpcConfig('station');
  const rosters = [
    new Date('2026-10-21T04:00:00.000Z'),
    new Date('2026-10-21T10:00:00.000Z'),
    new Date('2026-10-21T18:00:00.000Z'),
    new Date('2026-10-22T04:00:00.000Z'),
    new Date('2026-10-22T10:00:00.000Z'),
    new Date('2026-10-22T18:00:00.000Z'),
  ].map(time => activeNpcIds(config, time, sweden));
  assert.ok(new Set(rosters.map(ids => ids.join(','))).size > 1);
  for (const ids of rosters) {
    const ambient = ids.filter(id => config.ambientNpcPool.includes(id));
    assert.ok(ambient.length >= config.ambientCount.min);
    assert.ok(ambient.length <= config.ambientCount.max);
    assert.ok(config.serviceNpcIds.every(id => ids.includes(id)));
  }
});

test('invalid clock or country time zone uses one deterministic daytime fallback', () => {
  const config = venueNpcConfig('corner_cafe');
  const expected = { date: '2000-01-01', bucket: 'daytime' };
  assert.deepEqual(countryLocalSeedInput(null, sweden), expected);
  assert.deepEqual(countryLocalSeedInput(new Date(Number.NaN), sweden), expected);
  assert.deepEqual(countryLocalSeedInput(at(21, 12), 'Not/A_Zone'), expected);
  assert.deepEqual(activeNpcIds(config, null, sweden), activeNpcIds(config, at(21, 12), 'Not/A_Zone'));
});

const catalog = {
  locationIds: ['cafe'],
  npcIds: ['staff', 'optional', 'guest'],
  spawnZones: { customers: { left: 0, right: 10, top: 0, bottom: 10 } },
  exclusionZones: { entrance: { left: 20, right: 30, top: 20, bottom: 30 } },
};
const valid = {
  locationId: 'cafe', serviceNpcIds: ['staff'], optionalStaffNpcIds: ['optional'],
  ambientNpcPool: ['guest'], ambientCount: { min: 0, max: 1 },
  spawnZoneIds: ['customers'], exclusionZoneIds: ['entrance'],
  timeBuckets: ['morning', 'daytime', 'evening'],
};

test('venue validation accepts the complete shared contract', () => {
  assert.equal(validateVenueNpcConfig(valid, catalog), valid);
});

test('every invalid venue field reports its location and field', () => {
  const cases = [
    [{ ...valid, locationId: 'unknown' }, catalog, 'locationId'],
    [{ ...valid, serviceNpcIds: ['missing'] }, catalog, 'serviceNpcIds'],
    [{ ...valid, serviceNpcIds: ['staff', 'staff'] }, catalog, 'serviceNpcIds'],
    [{ ...valid, optionalStaffNpcIds: ['staff'] }, catalog, 'npc categories'],
    [{ ...valid, ambientNpcPool: ['missing'] }, catalog, 'ambientNpcPool'],
    [{ ...valid, ambientCount: { min: -1, max: 1 } }, catalog, 'ambientCount.min'],
    [{ ...valid, ambientCount: { min: 2, max: 1 } }, catalog, 'ambientCount.max'],
    [{ ...valid, ambientCount: { min: 0, max: 2 } }, catalog, 'ambientCount.max'],
    [{ ...valid, spawnZoneIds: [] }, catalog, 'spawnZoneIds'],
    [{ ...valid, spawnZoneIds: ['missing'] }, catalog, 'spawnZoneIds'],
    [{ ...valid, exclusionZoneIds: ['missing'] }, catalog, 'exclusionZoneIds'],
    [{ ...valid, timeBuckets: [] }, catalog, 'timeBuckets'],
    [{ ...valid, timeBuckets: ['night'] }, catalog, 'timeBuckets'],
    [valid, { ...catalog, spawnZones: { customers: { left: 5, right: 5, top: 0, bottom: 10 } } }, 'spawnZoneIds'],
    [valid, { ...catalog, exclusionZones: { entrance: { left: 20, right: 30, top: 40, bottom: 30 } } }, 'exclusionZoneIds'],
  ];
  for (const [config, candidateCatalog, field] of cases) {
    assert.throws(
      () => validateVenueNpcConfig(config, candidateCatalog),
      error => error instanceof Error && error.message.includes('Venue') && error.message.includes(config.locationId) && error.message.includes(field),
      `Expected ${field} failure to identify the location and field`,
    );
  }
});
