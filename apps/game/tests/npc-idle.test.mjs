import test from 'node:test';
import assert from 'node:assert/strict';
import { npcPose, patrolPose, advanceNpc } from '../src/features/npcs/npc-motion.ts';
import { canWalk, movePlayer, STATION_NPCS } from '../src/gameplay/station-navigation.ts';
import { stationNpc } from '../src/features/station/station-roster.ts';
import * as npcActors from '../src/features/npcs/npc-actors.ts';

const { setNpcActorVisibility, updateNpcActors } = npcActors;

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

test('Ruth stops on her desk patrol for interaction and world pause, then resumes in place', () => {
  const ruth = stationNpc('npc_station_information');
  const state = { x: ruth.x, y: ruth.y, elapsed: 0 };
  const far = { x: 100, y: 100 };
  advanceNpc(ruth.id, state, ruth, far, 50, false, null, movePlayer, ruth.patrol);
  const moving = { ...state };
  advanceNpc(ruth.id, state, ruth, far, 50, false, ruth.id, movePlayer, ruth.patrol);
  assert.deepEqual(state, moving);
  advanceNpc(ruth.id, state, ruth, far, 50, true, null, movePlayer, ruth.patrol);
  assert.deepEqual(state, moving);
  advanceNpc(ruth.id, state, ruth, far, 50, false, null, movePlayer, ruth.patrol);
  assert.equal(state.elapsed, moving.elapsed + 50);
  assert.ok(Math.hypot(state.x - moving.x, state.y - moving.y) < 3);
});

test('a nearby NPC replaces its name with a conversation-ready indicator', () => {
  const label = {
    text: 'Mia',
    visible: true,
    y: 0,
    scale: 1,
    setPosition(_x, y) { this.y = y; return this; },
    setText(value) { this.text = value; return this; },
    setColor() { return this; },
    setScale(value) { this.scale = value; return this; },
    setAlpha() { return this; },
    setVisible(value) { this.visible = value; return this; },
  };
  const sprite = {
    visible: true,
    displayHeight: 96,
    anims: { stop() {} },
    setPosition() { return this; },
    setDepth() { return this; },
    setFrame() { return this; },
    play() { return this; },
    setVisible(value) { this.visible = value; return this; },
  };
  const dots = Array.from({ length: 3 }, () => ({
    text: '●',
    visible: false,
    y: 0,
    setPosition(_x, y) { this.y = y; return this; },
    setVisible(value) { this.visible = value; return this; },
  }));
  const actor = {
    npc: { id: 'npc_mia', name: 'Mia', texture: 'mia', x: 800, y: 500 },
    anchor: { x: 800, y: 500 },
    sprite,
    label,
    indicatorDots: dots,
    elapsed: 0,
    idleFrame: '0-0',
  };

  updateNpcActors([actor], { x: 800, y: 500 }, 16, false);

  assert.equal(label.visible, false);
  assert.deepEqual(dots.map(dot => dot.visible), [true, true, true]);
  assert.equal(new Set(dots.map(dot => dot.y)).size, 3, 'the three fixed dots bob with staggered phases');
  assert.ok(dots.every(dot => dot.y >= 410 && dot.y <= 425), 'the indicator clears the head without floating too far above it');
  assert.equal(label.scale, 1, 'the bob animation does not resize the indicator');

  setNpcActorVisibility(actor, true);

  assert.equal(label.visible, false, 'a visibility refresh does not reveal the name over the indicator');
  assert.deepEqual(dots.map(dot => dot.visible), [true, true, true]);

  updateNpcActors([actor], { x: 800, y: 500 }, 280, false);

  assert.deepEqual(dots.map(dot => dot.text), ['●', '●', '●']);

  const beforeConversationWave = dots.map(dot => dot.y);
  updateNpcActors([actor], { x: 800, y: 500 }, 160, true, 'npc_mia');

  assert.equal(label.visible, false, 'the active conversation keeps the NPC name hidden');
  assert.deepEqual(dots.map(dot => dot.visible), [true, true, true]);
  assert.notDeepEqual(dots.map(dot => dot.y), beforeConversationWave, 'the wave continues while the conversation pauses the world');

  updateNpcActors([actor], { x: 0, y: 0 }, 16, false);

  assert.equal(label.text, 'Mia');
});

test('NPC nameplates use compact responsive sizes on mobile and tablet', () => {
  assert.equal(typeof npcActors.npcNameplateScreenSizes, 'function');
  assert.equal(typeof npcActors.npcSublabelScreenSize, 'function');
  assert.deepEqual(npcActors.npcNameplateScreenSizes(375), { name: 13, dots: 16 });
  assert.deepEqual(npcActors.npcNameplateScreenSizes(768), { name: 15, dots: 18 });
  assert.deepEqual(npcActors.npcNameplateScreenSizes(1280), { name: 17, dots: 20 });
  assert.equal(npcActors.npcSublabelScreenSize(375), 9);
  assert.equal(npcActors.npcSublabelScreenSize(1280), 11);
});

test('resizing nameplates uses cheap transforms instead of rebuilding text textures', () => {
  assert.equal(typeof npcActors.scaleNpcNameplates, 'function');
  const name = { scale: 0, setScale(value) { this.scale = value; return this; } };
  const dot = { scale: 0, setScale(value) { this.scale = value; return this; } };

  npcActors.scaleNpcNameplates([name], [dot], 375, 0.5);

  assert.equal(name.scale, 13 / 0.5 / 24);
  assert.equal(dot.scale, 16 / 0.5 / 28);
});
