import test from 'node:test';
import assert from 'node:assert/strict';
import { npcPose, advanceNpc } from '../src/features/npcs/npc-motion.ts';
import { canWalk, movePlayer, STATION_NPCS } from '../src/gameplay/station-navigation.ts';

// Checks every station route against the real walkable area, including obstacles.
test('station patrols remain walkable and counter staff stay stationary', () => {
  for (const npc of STATION_NPCS) for (let time = 0; time < 60000; time += 100) {
    const pose = npcPose(npc.id, npc, time, movePlayer);
    assert.ok(canWalk(pose));
    if (npc.id === 'npc_station_information') assert.deepEqual(pose, { x: npc.x, y: npc.y, direction: 'down', moving: false });
  }
  const anchor = { x: 800, y: 275 };
  for (const id of ['npc_mia', 'npc_cafe_customer', 'npc_clothes_seller']) {
    assert.deepEqual(npcPose(id, anchor, 30000), { ...anchor, direction: 'down', moving: false });
  }
});

test('NPC profiles use distinct routes, speeds and pauses without jumping', () => {
  const anchor = { x: 800, y: 500 };
  const ids = ['npc_cafe_waiter', 'npc_clothes_assistant', 'npc_clothes_customer'];
  assert.equal(new Set(ids.map(id => JSON.stringify(npcPose(id, anchor, 1000)))).size, 3);
  for (const id of ids) {
    let waited = false, moved = false;
    for (let time = 0; time < 60000; time += 50) {
      const pose = npcPose(id, anchor, time);
      const next = npcPose(id, anchor, time + 50);
      assert.ok(Math.hypot(next.x - pose.x, next.y - pose.y) <= 1.501);
      assert.ok(Math.abs(pose.x - anchor.x) <= 40 && Math.abs(pose.y - anchor.y) <= 40);
      waited ||= !pose.moving; moved ||= pose.moving;
    }
    assert.ok(waited && moved);
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
