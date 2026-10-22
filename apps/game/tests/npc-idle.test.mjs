import test from 'node:test';
import assert from 'node:assert/strict';
import { npcPose, patrolPose, advanceNpc } from '../src/features/npcs/npc-motion.ts';
import { canWalk, movePlayer, STATION_NPCS } from '../src/gameplay/station-navigation.ts';
import { stationNpc } from '../src/features/station/station-roster.ts';

// Checks every station route against the real walkable area, including obstacles.
test('station patrols remain walkable and the receptionist stays near the desk', () => {
  for (const npc of STATION_NPCS) for (let time = 0; time < 60000; time += 100) {
    const patrol = stationNpc(npc.id).patrol;
    const pose = patrol ? patrolPose(patrol, time) : npcPose(npc.id, npc, time, movePlayer);
    assert.ok(canWalk(pose));
    if (npc.id === 'npc_station_information') assert.ok(Math.hypot(pose.x - npc.x, pose.y - npc.y) <= 55);
  }
  const anchor = { x: 800, y: 275 };
  for (const id of ['npc_mia', 'npc_cafe_customer', 'npc_clothes_seller']) {
    assert.deepEqual(npcPose(id, anchor, 30000), { ...anchor, direction: 'down', moving: false });
  }
});

test('Walking NPCs use distinct routes and speeds without waypoint pauses or jumps', () => {
  const anchor = { x: 800, y: 500 };
  const ids = ['npc_cafe_waiter', 'npc_clothes_assistant', 'npc_clothes_customer'];
  assert.equal(new Set(ids.map(id => JSON.stringify(npcPose(id, anchor, 1000)))).size, 3);
  for (const id of [...ids, 'npc_passenger_backpack', 'npc_passenger_suitcase', 'npc_corner_cup_assistant', 'npc_corner_cup_customer_1', 'npc_corner_cup_customer_3']) {
    for (let time = 0; time < 60000; time += 50) {
      const pose = npcPose(id, anchor, time);
      const next = npcPose(id, anchor, time + 50);
      assert.ok(Math.hypot(next.x - pose.x, next.y - pose.y) <= 1.501);
      assert.ok(Math.abs(pose.x - anchor.x) <= 40 && Math.abs(pose.y - anchor.y) <= 40);
      assert.equal(pose.moving, true, `${id} stopped at ${time}ms`);
    }
  }
});

test('approach, selection and pause freeze the route clock; resuming stays continuous', () => {
  const anchor = { x: 800, y: 500 }, id = 'npc_cafe_waiter';
  const state = { ...anchor, elapsed: 100 };
  const far = { x: 50, y: 50 };
  advanceNpc(id, state, anchor, far, 50, false, null);
  const previous = { ...state };
  for (const [player, paused, selected] of [[state, false, null], [far, true, null], [far, false, id]]) {
    assert.equal(advanceNpc(id, state, anchor, player, 50, paused, selected).moving, false);
    assert.deepEqual(state, previous);
  }
  advanceNpc(id, state, anchor, far, 10000, false, null);
  assert.equal(state.elapsed, previous.elapsed + 50);
  assert.ok(Math.hypot(state.x - previous.x, state.y - previous.y) <= 1.501);
});
