import assert from 'node:assert/strict';
import test from 'node:test';
import * as stationRoster from '../src/features/station/station-roster.ts';
import { canWalk, portalAt, STATION_PORTALS } from '../src/gameplay/station-navigation.ts';
import { npcVoice } from '../src/speech/npc-voice.ts';
import { stationGreeting } from '@life-abroad/shared';
import { access } from 'node:fs/promises';
import { tutorialText } from '../src/speech/tutorial-text.ts';

const { stationNpc, STATION_PASSENGERS, STATION_ROSTER } = stationRoster;

test('station roster has one receptionist and three consistent passenger identities', () => {
  assert.equal(STATION_ROSTER.length, 4);
  assert.equal(STATION_PASSENGERS.length, 3);
  assert.equal(new Set(STATION_ROSTER.map(npc => npc.id)).size, 4);
  assert.equal(new Set(STATION_ROSTER.map(npc => npc.name)).size, 4);
  assert.ok(STATION_ROSTER.every(npc => !['Peter', 'Emma'].includes(npc.name)));
  assert.deepEqual(STATION_PASSENGERS.map(npc => [npc.id, npc.name]), [
    ['npc_passenger_backpack', 'Sofia'],
    ['npc_passenger_suitcase', 'Elias'],
    ['npc_passenger_visitor', 'Ingrid'],
  ]);
  for (const npc of STATION_ROSTER) {
    assert.equal(npcVoice[npc.id], npc.voice);
    assert.equal(typeof npc.portrait, 'string');
    assert.ok(npc.portrait.length > 0);
  }
});

test('station NPC sprites share the player display height', () => {
  const frameHeights = { backpack: 48, suitcase: 48, receptionist: 48, visitor: 171 };
  for (const npc of STATION_ROSTER) assert.equal(frameHeights[npc.texture] * npc.scale, 96);
});

test('station identities keep bundled sprite and portrait assets', async () => {
  const assets = [
    '../assets/runtime/receptionist.png',
    '../assets/runtime/receptionist-portrait.png',
    '../assets/runtime/backpack.png',
    '../assets/runtime/backpack-portrait.png',
    '../assets/runtime/suitcase.png',
    '../assets/runtime/suitcase-portrait.png',
    '../assets/npcs/npc_cafe_customer/walk.png',
    '../assets/npcs/npc_cafe_customer/portraits.png',
  ];
  await Promise.all(assets.map(asset => access(new URL(asset, import.meta.url))));
});

test('station tutorial allows a variable passenger roster', () => {
  assert.doesNotMatch(tutorialText, /\b(?:two|2) passengers\b/i);
  assert.match(tutorialText, /passengers are happy to chat/i);
});

test('all three passengers have dialogue and safe station spawns', () => {
  for (const passenger of STATION_PASSENGERS) {
    assert.ok(stationGreeting(passenger.id).text.length > 0);
    assert.equal(canWalk(passenger), true);
    assert.equal(portalAt(passenger, STATION_PORTALS, 100), null);
    assert.equal(stationNpc(passenger.id), passenger);
  }
});

test('every station roster identity is accepted by the dialogue interaction boundary', () => {
  assert.equal(typeof stationRoster.isStationSpeaker, 'function');
  for (const npc of STATION_ROSTER) assert.equal(stationRoster.isStationSpeaker(npc.id), true);
  assert.equal(stationRoster.isStationSpeaker('npc_unknown'), false);
});

test('receptionist patrol stays walkable and close to the information desk', () => {
  const receptionist = stationNpc('npc_station_information');
  assert.ok(receptionist.patrol);
  for (const point of receptionist.patrol.points) {
    assert.equal(canWalk(point), true);
    assert.ok(Math.hypot(point.x - receptionist.x, point.y - receptionist.y) <= 55);
  }
});
