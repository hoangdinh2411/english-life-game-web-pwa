import assert from 'node:assert/strict';
import test from 'node:test';
import { STREET_NPCS, STREET_NPC_ROUTES } from '../src/features/npcs/street-npcs.ts';
import { updateNpcActors } from '../src/features/npcs/npc-actors.ts';
import { advanceNpc, NPC_TURN_PAUSE_MS, patrolPose } from '../src/features/npcs/npc-motion.ts';
import { canWalkStreet, scaleStreetPoint } from '../src/gameplay/station-navigation.ts';

test('Residents keep all four outer neighborhoods populated without crowding the central plaza', () => {
  for (let elapsed = 0; elapsed <= 600000; elapsed += 1000) {
    const positions = STREET_NPCS.map(npc => {
      const points = STREET_NPC_ROUTES.find(route => route.id === npc.routeId).points;
      return npc.stationary ? points[npc.startWaypoint] : patrolPose({ points, startWaypoint: npc.startWaypoint }, elapsed, 46 / 1.5);
    });
    for (const [name, contains] of [
      ['northwest', point => point.x < 700 && point.y < 500],
      ['northeast', point => point.x > 900 && point.y < 500],
      ['southwest', point => point.x < 700 && point.y > 800],
      ['southeast', point => point.x > 900 && point.y > 800],
    ]) assert.equal(positions.filter(contains).length, 3, `${name} needs three residents at ${elapsed}ms`);
    assert.ok(positions.filter(point => point.x >= 660 && point.x <= 900 && point.y >= 300 && point.y <= 550).length <= 2, 'Central plaza should remain lightly populated');
  }
});

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

test('Several moving residents have vertical road patrols', () => {
  const verticalWalkers = STREET_NPCS.filter(npc => {
    if (npc.stationary) return false;
    const route = STREET_NPC_ROUTES.find(candidate => candidate.id === npc.routeId);
    return route?.points.some((point, index) => {
      const next = route.points[index + 1];
      return next && point.x === next.x && point.y !== next.y;
    });
  });
  assert.ok(verticalWalkers.length >= 2);
  assert.ok(verticalWalkers.some(npc => npc.name === 'Ethan'));
  assert.ok(verticalWalkers.some(npc => npc.name === 'Ben'));
});

test('Town Street names, voices, walking sprites, and portrait data stay consistent', () => {
  const expectedVoiceByName = new Map([
    ['Mila', 'female'], ['Amir', 'male'], ['Ethan', 'male'], ['Lina', 'female'],
    ['Ben', 'male'], ['Maya', 'female'], ['Raj', 'male'], ['Nora', 'female'],
    ['Leo', 'male'], ['Dylan', 'male'], ['Amara', 'female'], ['Owen', 'male'],
    ['Sara', 'female'], ['Jamal', 'male'], ['Tara', 'female'],
  ]);
  for (const npc of STREET_NPCS) {
    assert.equal(npc.voice, expectedVoiceByName.get(npc.name), `${npc.name} has a mismatched name/voice`);
    assert.equal(npc.frame, 'walk');
    assert.equal(npc.walkImageUrl, `npcs/${npc.id}/walk.png`);
    assert.equal(npc.portrait.imageUrl, `npcs/${npc.id}/portraits.png`);
    assert.equal(npc.portrait.columns, 3);
    assert.equal(npc.portrait.rows, 1);
  }
  assert.ok(STREET_NPCS.every(npc => npc.portrait.index === 0));
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
      assert.ok(canWalkStreet(current), `${npc.id} left its road at ${time}ms`);
      assert.ok(Math.hypot(current.x - previous.x, current.y - previous.y) <= 1.16, `${npc.id} jumped`);
      distance += Math.hypot(current.x - previous.x, current.y - previous.y);
      previous = current;
    }
    assert.ok(distance >= 1200, `${npc.id} should travel a long route`);
  }
});

test('Street patrols pass straight waypoints and pause 2.5 seconds before turning', () => {
  const patrol = { points: [{ x: 0, y: 0 }, { x: 46, y: 0 }, { x: 92, y: 0 }], startWaypoint: 0 };
  const poses = [
    [1000, 46, 'right', true], [1500, 69, 'right', true],
    [2000, 92, 'right', false], [4499, 92, 'right', false],
    [4500, 92, 'left', true], [5000, 69, 'left', true],
    [5500, 46, 'left', true], [6500, 0, 'left', false],
    [8999, 0, 'left', false], [9000, 0, 'right', true],
    [9500, 23, 'right', true],
  ];
  for (const [time, x, direction, moving] of poses) {
    assert.deepEqual(patrolPose(patrol, time), { x, y: 0, direction, moving });
  }
  assert.equal(NPC_TURN_PAUSE_MS, 2500);
  const vertical = patrolPose({ points: [{ x: 0, y: 0 }, { x: 0, y: 46 }], startWaypoint: 0 }, 3500);
  assert.deepEqual(vertical, { x: 0, y: 46, direction: 'up', moving: true });
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
      displayHeight: 96,
      setPosition() { return this; }, setDepth() { return this; },
      anims: { stop() {} }, setFrame() {}, play() {},
    };
    return {
      npc: { id, name: id, texture: 'test', x, y: 100 },
      anchor: { x, y: 100 }, sprite,
      label: {
        setPosition() { return this; }, setText() { return this; }, setColor() { return this; },
        setScale() { return this; }, setAlpha() { return this; }, setVisible() { return this; },
      },
      elapsed: 0, idleFrame: 'idle',
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

test('NPC patrol animation selects the matching frame row for all four directions', () => {
  const cases = [
    { destination: { x: 100, y: 140 }, animation: 'test-walk-0' },
    { destination: { x: 60, y: 100 }, animation: 'test-walk-1' },
    { destination: { x: 140, y: 100 }, animation: 'test-walk-2' },
    { destination: { x: 100, y: 60 }, animation: 'test-walk-3' },
  ];
  for (const { destination, animation } of cases) {
    let played = '';
    const actor = makeActor('npc_amir_courier', 100);
    actor.walkPrefix = 'test-walk';
    actor.patrol = { points: [{ x: 100, y: 100 }, destination], startWaypoint: 0 };
    actor.sprite.play = key => { played = key; };
    updateNpcActors([actor], { x: -1000, y: -1000 }, 50, false, null);
    assert.equal(played, animation);
  }
});

test('Idle NPCs keep their configured display scale while stopped', () => {
  let scaleChanges = 0;
  const actor = makeActor('npc_mila_florist', 100);
  actor.patrol = undefined;
  actor.sprite.scaleX = 0.6;
  actor.sprite.scaleY = 0.6;
  actor.sprite.setScale = () => { scaleChanges += 1; return actor.sprite; };
  updateNpcActors([actor], { x: 500, y: 500 }, 500, false, null);
  assert.equal(scaleChanges, 0);
  assert.equal(actor.sprite.scaleX, 0.6);
  assert.equal(actor.sprite.scaleY, 0.6);
});
