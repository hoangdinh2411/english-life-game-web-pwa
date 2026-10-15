import assert from 'node:assert/strict';
import test from 'node:test';
import { STREET_NPCS, STREET_NPC_ROUTES } from '../src/features/npcs/street-npcs.ts';
import { updateNpcActors } from '../src/features/npcs/npc-actors.ts';
import { advanceNpc, patrolPose } from '../src/features/npcs/npc-motion.ts';
import { canWalkStreet, scaleStreetPoint } from '../src/gameplay/station-navigation.ts';

test('Town Street residents have distinct profiles and 10–15 walkable route steps', () => {
  assert.equal(STREET_NPCS.length, 15);
  assert.equal(new Set(STREET_NPCS.map(npc => npc.id)).size, 15);
  assert.equal(new Set(STREET_NPCS.map(npc => npc.name)).size, 15);
  assert.ok(new Set(STREET_NPCS.map(npc => npc.job)).size >= 10);
  for (const route of STREET_NPC_ROUTES) {
    assert.ok(route.points.length >= 10 && route.points.length <= 15, route.id);
    const samples = [];
    for (const [index, point] of route.points.entries()) {
      samples.push(point);
      const next = route.points[index + 1];
      if (!next) continue;
      const steps = Math.ceil(Math.hypot(next.x - point.x, next.y - point.y) / 4);
      for (let step = 1; step < steps; step++) samples.push({
        x: point.x + (next.x - point.x) * step / steps,
        y: point.y + (next.y - point.y) * step / steps,
      });
    }
    assert.ok(samples.every(point => canWalkStreet(scaleStreetPoint(point))), `${route.id} leaves the streets`);
  }
  for (const npc of STREET_NPCS) {
    const route = STREET_NPC_ROUTES.find(candidate => candidate.id === npc.routeId);
    assert.ok(route);
    assert.ok(npc.startWaypoint < route.points.length);
    assert.ok(npc.topics.length >= 3);
  }
});

test('Town Street names, voices, walking sprites, and portraits agree on gender', () => {
  const expectedVoiceByName = new Map([
    ['Mila', 'female'], ['Amir', 'male'], ['Ethan', 'male'], ['Lina', 'female'],
    ['Ben', 'male'], ['Maya', 'female'], ['Raj', 'male'], ['Nora', 'female'],
    ['Leo', 'male'], ['Dylan', 'male'], ['Amara', 'female'], ['Owen', 'male'],
    ['Sara', 'female'], ['Jamal', 'male'], ['Tara', 'female'],
  ]);
  const genderByFrame = new Map([
    ['cafe_seller', 'female'], ['cafe_waiter', 'male'], ['cafe_customer', 'female'],
    ['clothes_seller', 'male'], ['clothes_assistant', 'male'], ['clothes_customer', 'female'],
  ]);

  for (const npc of STREET_NPCS) {
    assert.equal(npc.voice, expectedVoiceByName.get(npc.name), `${npc.name} has a mismatched name/voice`);
    assert.equal(genderByFrame.get(npc.frame), npc.voice, `${npc.name} has a mismatched walking sprite`);
    assert.equal(genderByFrame.get(npc.portraitFrame), npc.voice, `${npc.name} has a mismatched portrait`);
  }
});

test('Street patrols travel long routes smoothly and remain on their authored roads', () => {
  for (const npc of STREET_NPCS) {
    const route = STREET_NPC_ROUTES.find(candidate => candidate.id === npc.routeId);
    assert.ok(route);
    const patrol = { points: route.points.map(scaleStreetPoint), startWaypoint: npc.startWaypoint };
    const start = patrolPose(patrol, 0);
    const anchored = scaleStreetPoint(route.points[npc.startWaypoint]);
    assert.deepEqual({ x: start.x, y: start.y }, anchored);
    let distance = 0;
    let previous = start;
    for (let time = 25; time <= 60000; time += 25) {
      const current = patrolPose(patrol, time);
      assert.equal(current.moving, true, `${npc.id} paused at a waypoint at ${time}ms`);
      assert.ok(canWalkStreet(current), `${npc.id} left its road at ${time}ms`);
      assert.ok(Math.hypot(current.x - previous.x, current.y - previous.y) <= 1.16, `${npc.id} jumped`);
      distance += Math.hypot(current.x - previous.x, current.y - previous.y);
      previous = current;
    }
    assert.ok(distance >= 1200, `${npc.id} should travel a long route`);
  }
});

test('Street patrols cross waypoints and turnarounds at constant speed without an idle frame', () => {
  const patrol = { points: [{ x: 0, y: 0 }, { x: 46, y: 0 }, { x: 92, y: 0 }], startWaypoint: 0 };
  for (const [time, x, direction] of [[1000, 46, 'right'], [1500, 69, 'right'], [2000, 92, 'left'], [2500, 69, 'left'], [4000, 0, 'right'], [4500, 23, 'right']]) {
    assert.deepEqual(patrolPose(patrol, time), { x, y: 0, direction, moving: true });
  }
});


test('Street residents stop nearby, resume when the player leaves, and respect selection and pause', () => {
  const anchor = { x: 100, y: 100 };
  const patrol = { points: [anchor, { x: 300, y: 100 }], startWaypoint: 0 };
  const state = { ...anchor, elapsed: 0 };
  let player = anchor;
  const step = (paused = false, selected = null) => advanceNpc(
    'npc_amir_courier', state, anchor, player, 50, paused, selected, undefined, patrol,
  );
  assert.equal(step().moving, false);
  assert.equal(state.elapsed, 0);
  player = { x: -1000, y: -1000 };
  assert.equal(step().moving, true);
  assert.ok(state.x > anchor.x);
  const elapsed = state.elapsed;
  assert.equal(step(false, 'npc_amir_courier').moving, false);
  assert.equal(step(true).moving, false);
  assert.equal(state.elapsed, elapsed);
  assert.equal(step().moving, true);
});


test('Four authored residents stay at their anchors while the remaining residents patrol', () => {
  const stationary = STREET_NPCS.filter(npc => npc.stationary);
  assert.deepEqual(stationary.map(npc => npc.name), ['Mila', 'Lina', 'Amara', 'Tara']);
  assert.equal(STREET_NPCS.filter(npc => !npc.stationary).length, 11);
  for (const npc of stationary) {
    const route = STREET_NPC_ROUTES.find(candidate => candidate.id === npc.routeId);
    const anchor = scaleStreetPoint(route.points[npc.startWaypoint]);
    const state = { ...anchor, elapsed: 0 };
    for (let frame = 0; frame < 1200; frame++) {
      const pose = advanceNpc(npc.id, state, anchor, { x: -1000, y: -1000 }, 50, false, null);
      assert.equal(pose.moving, false);
      assert.equal(pose.x, anchor.x);
      assert.equal(pose.y, anchor.y);
    }
  }
});


  const makeActor = (id, x) => {
    const sprite = {
      setPosition() { return this; }, setDepth() { return this; },
      anims: { stop() {} }, setFrame() {}, play() {},
    };
    return {
      npc: { id, name: id, texture: 'test', x, y: 100 },
      anchor: { x, y: 100 }, sprite,
      label: { setPosition() {} }, elapsed: 0, labelOffset: 105, idleFrame: 'idle',
      patrol: { points: [{ x, y: 100 }, { x: x + 300, y: 100 }], startWaypoint: 0 },
    };
  };
test('Conversation holds only its NPC while nearby bystanders move; world pause stops everyone', () => {
  const speaker = makeActor('npc_amir_courier', 100);
  const bystander = makeActor('npc_ethan_baker', 120);
  const actors = [speaker, bystander];
  const player = { x: 100, y: 100 };
  updateNpcActors(actors, player, 50, false, speaker.npc.id);
  assert.equal(speaker.npc.x, 100);
  assert.equal(speaker.elapsed, 0);
  assert.ok(bystander.npc.x > 120);
  const previous = bystander.npc.x;
  updateNpcActors(actors, player, 50, true, speaker.npc.id);
  assert.equal(bystander.npc.x, previous);
  updateNpcActors(actors, player, 50, false, null);
  assert.ok(bystander.npc.x > previous, 'only the closest resident stops after dialogue closes');
  updateNpcActors(actors, { x: -1000, y: -1000 }, 50, false, null);
  assert.ok(speaker.npc.x > 100);
  assert.ok(bystander.npc.x > previous);
});


test('Only the single nearest NPC within one step stops and the previous nearest resumes', () => {
  const closest = makeActor('npc_amir_courier', 100);
  const other = makeActor('npc_ethan_baker', 120);
  const actors = [closest, other];
  updateNpcActors(actors, { x: 40, y: 100 }, 50, false, null);
  assert.equal(closest.elapsed, 0, '60 units is within one step');
  assert.equal(other.elapsed, 50, 'other residents continue walking');
  updateNpcActors(actors, { x: 39, y: 100 }, 50, false, null);
  assert.equal(closest.elapsed, 50, '61 units no longer freezes the NPC');
  const before = closest.elapsed;
  const otherBefore = other.elapsed;
  updateNpcActors(actors, { x: 120, y: 100 }, 50, false, null);
  assert.ok(closest.elapsed > before, 'previous nearest resumes');
  assert.equal(other.elapsed, otherBefore, 'new nearest stops');
});

test('Equal-distance residents stop only one NPC', () => {
  const first = makeActor('npc_amir_courier', 100);
  const second = makeActor('npc_ethan_baker', 100);
  updateNpcActors([first, second], { x: 100, y: 100 }, 50, false, null);
  assert.equal(first.elapsed, 0);
  assert.equal(second.elapsed, 50);
});
