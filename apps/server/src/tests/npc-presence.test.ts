import assert from 'node:assert/strict';
import test from 'node:test';
import type { NpcProfile } from '@life-abroad/shared';
import { nextPresenceChange, npcIsPresent } from '../modules/npcs/npc-presence.service';
import { NpcPresenceService } from '../modules/npcs/npc-presence.service';
import { Client } from 'pg';

const local = (day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', minutes: number) => ({ day, minutes });
const scheduled = (slots: NonNullable<NpcProfile['presenceSchedule']>['weeklySlots']): NpcProfile => ({
  profileVersion: 1, presenceSchedule: { timeZoneSource: 'player_country', weeklySlots: slots },
});
const street = (profile: NpcProfile) => ({ id: 'npc_mila_florist', location_id: 'loc_town_street', profile });

test('NPC-05 schedule boundaries are start-inclusive and end-exclusive', () => {
  const row = street(scheduled([{ days: ['mon'], start: '08:00', end: '12:00', locationId: 'loc_town_street' }]));
  assert.equal(npcIsPresent(row, 'loc_town_street', local('mon', 479)), false);
  assert.equal(npcIsPresent(row, 'loc_town_street', local('mon', 480)), true);
  assert.equal(npcIsPresent(row, 'loc_town_street', local('mon', 719)), true);
  assert.equal(npcIsPresent(row, 'loc_town_street', local('mon', 720)), false);
});

test('NPC-05 supports multiple shifts and overnight rollover', () => {
  const row = street(scheduled([
    { days: ['mon'], start: '08:00', end: '10:00', locationId: 'loc_town_street' },
    { days: ['mon'], start: '20:00', end: '02:00', locationId: 'loc_town_street' },
  ]));
  assert.equal(npcIsPresent(row, 'loc_town_street', local('mon', 9 * 60)), true);
  assert.equal(npcIsPresent(row, 'loc_town_street', local('mon', 15 * 60)), false);
  assert.equal(npcIsPresent(row, 'loc_town_street', local('tue', 60)), true);
  assert.equal(npcIsPresent(row, 'loc_town_street', local('tue', 120)), false);
});

test('NPC-05 fails closed for unscheduled street NPCs and constrains store fallback', () => {
  assert.equal(npcIsPresent(street({ profileVersion: 1 }), 'loc_town_street', local('mon', 9 * 60)), false);
  const shop = { id: 'npc_cafe_customer', location_id: 'loc_cafe', profile: { profileVersion: 1 } as NpcProfile };
  assert.equal(npcIsPresent(shop, 'loc_cafe', local('mon', 8 * 60)), true);
  assert.equal(npcIsPresent(shop, 'loc_cafe', local('mon', 14 * 60)), false);
});

test('NPC-05 next boundary follows country-local DST and weekday rollover', () => {
  const profile = scheduled([{ days: ['sun'], start: '03:00', end: '04:00', locationId: 'loc_town_street' }]);
  const row = { ...street(profile), clock_time: new Date(), clock_anchor: new Date(), clock_rate: 2, time_zone: 'Europe/Stockholm' };
  const spring = nextPresenceChange([row], 'loc_town_street', new Date('2026-03-29T00:30:00Z'), 'Europe/Stockholm');
  assert.equal(spring?.toISOString(), '2026-03-29T01:00:00.000Z');
  const rollover = nextPresenceChange([row], 'loc_town_street', new Date('2026-03-28T22:30:00Z'), 'Europe/Stockholm');
  assert.equal(rollover?.toISOString(), '2026-03-29T01:00:00.000Z');
});

test('NPC-05 conversation-start guard rejects absent NPCs and malformed profiles', async t => {
  const client = Object.assign(new Client(), { release: () => undefined });
  let profile: unknown = { profileVersion: 1 };
  t.mock.method(client, 'query', async () => ({ rows: [{
    id: 'npc_mila_florist', location_id: 'loc_town_street', profile,
    clock_time: new Date('2026-06-01T08:00:00Z'), clock_anchor: new Date(), clock_rate: 1,
    time_zone: 'Europe/Stockholm',
  }] }));
  const worldClock = { read: async () => ({ gameTimeUtc: new Date('2026-06-01T08:00:00Z'), timeZone: 'Europe/Stockholm' }) };
  const service = new NpcPresenceService({} as never, worldClock as never);
  await assert.rejects(service.assertCanStart(client, 'user', 'npc_mila_florist'), /NPC is not here right now/);
  profile = { profileVersion: 1, unknown: true };
  await assert.rejects(service.assertCanStart(client, 'user', 'npc_mila_florist'), /unrecognized key/i);
});
