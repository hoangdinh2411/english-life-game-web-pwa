import assert from 'node:assert/strict';
import test from 'node:test';
import { stationNpc, STATION_PASSENGERS, STATION_ROSTER } from '../src/features/station/station-roster.ts';
import { canWalk, portalAt, STATION_PORTALS } from '../src/gameplay/station-navigation.ts';
import { npcVoice } from '../src/speech/npc-voice.ts';
import { stationGreeting } from '@life-abroad/shared';

test('station roster has one receptionist and three consistent passenger identities', () => {
  assert.equal(STATION_ROSTER.length, 4);
  assert.equal(STATION_PASSENGERS.length, 3);
  assert.equal(new Set(STATION_ROSTER.map(npc => npc.id)).size, 4);
  assert.equal(new Set(STATION_ROSTER.map(npc => npc.name)).size, 4);
  assert.ok(STATION_ROSTER.every(npc => !['Peter', 'Emma'].includes(npc.name)));
  for (const npc of STATION_ROSTER) {
    assert.equal(npcVoice[npc.id], npc.voice);
    assert.equal(typeof npc.portrait, 'string');
    assert.ok(npc.portrait.length > 0);
  }
});

test('all three passengers have dialogue and safe station spawns', () => {
  for (const passenger of STATION_PASSENGERS) {
    assert.ok(stationGreeting(passenger.id).text.length > 0);
    assert.equal(canWalk(passenger), true);
    assert.equal(portalAt(passenger, STATION_PORTALS, 100), null);
    assert.equal(stationNpc(passenger.id), passenger);
  }
});

test('receptionist patrol stays walkable and close to the information desk', () => {
  const receptionist = stationNpc('npc_station_information');
  assert.ok(receptionist.patrol);
  for (const point of receptionist.patrol.points) {
    assert.equal(canWalk(point), true);
    assert.ok(Math.hypot(point.x - receptionist.x, point.y - receptionist.y) <= 55);
  }
});
