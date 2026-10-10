import assert from 'node:assert/strict';
import test from 'node:test';
import { goalNotice, npcNeedsTalk } from '../src/gameplay/arrival-hud.ts';
test('goal badges count active/new goals and markers exclude completed/locked goals', () => {
  const goals = ['current', 'new', 'complete', 'upcoming', 'locked'].map((status) => ({ id: status, status, npcId: status }));
  assert.deepEqual(goalNotice(goals), { active: 1, fresh: 1 });
  for (const status of ['current', 'new']) assert.equal(npcNeedsTalk(status, goals), true);
  for (const status of ['complete', 'upcoming', 'locked', 'unknown']) assert.equal(npcNeedsTalk(status, goals), false);
  assert.deepEqual(goalNotice([]), { active: 0, fresh: 0 });
  assert.equal(npcNeedsTalk('npc_station_information'), true);
  assert.equal(npcNeedsTalk('npc_passenger_backpack'), false);
});
