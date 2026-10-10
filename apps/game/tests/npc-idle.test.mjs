import test from 'node:test';
import assert from 'node:assert/strict';
import { npcIdlePose } from '../src/gameplay/npc-idle.ts';
import { canWalk, nearestNpc, STATION_NPCS } from '../src/gameplay/station-navigation.ts';
test('NPCs take short straight walks in all directions and avoid obstacles', () => {
  for (const [index, npc] of STATION_NPCS.entries()) {
    const directions = new Set();
    for (let time = 0; time <= 8000; time += 100) {
      const pose = npcIdlePose(npc, time, index);
      assert.ok(Math.abs(pose.x - npc.x) <= 48);
      assert.ok(Math.abs(pose.y - npc.y) <= 48);
      assert.ok(pose.x === npc.x || pose.y === npc.y);
      assert.ok(canWalk(pose));
      directions.add(pose.direction);
    }
    assert.deepEqual(directions, new Set(['left', 'right', 'up', 'down']));
    const start = npcIdlePose(npc, 0, index);
    const end = npcIdlePose(npc, 8000, index);
    assert.ok(Math.hypot(start.x - end.x, start.y - end.y) < 0.001);
  }
});
test('interaction uses current NPC positions without changing the authored anchors', () => {
  const moving = STATION_NPCS.map((npc, index) => ({ ...npc, ...npcIdlePose(npc, 2000, index) }));
  assert.equal(nearestNpc({ x: moving[0].x, y: moving[0].y }, moving)?.id, moving[0].id);
  assert.equal(STATION_NPCS[0].x, 592);
});

test('NPCs keep moving immediately before and after direction changes', () => {
  for (const [index, npc] of STATION_NPCS.entries()) {
    for (let time = 50; time < 8000; time += 50) {
      const before = npcIdlePose(npc, time - 10, index);
      const current = npcIdlePose(npc, time, index);
      const after = npcIdlePose(npc, time + 10, index);
      assert.ok(Math.hypot(current.x - before.x, current.y - before.y) > 0);
      assert.ok(Math.hypot(after.x - current.x, after.y - current.y) > 0);
      assert.ok(Math.hypot(after.x - current.x, after.y - current.y) <= 0.481);
    }
  }
});
