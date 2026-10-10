import assert from 'node:assert/strict';
import test from 'node:test';
import { createArrivalController } from '../src/features/station/arrival-controller.ts';
const station = { questId: 'q_station_arrival', status: 'active', currentStepId: 'greet', ticket: { issued: false, used: false }, canEnterTownStreet: false, locationId: 'loc_station', rewardsGranted: false };
const ticket = { ...station, ticket: { issued: true, used: false }, canEnterTownStreet: true };
const street = { ...ticket, status: 'done', currentStepId: null, ticket: { issued: true, used: true }, locationId: 'loc_town_street', rewardsGranted: true };
const conversation = { id: 'session-id', npcId: 'npc_receptionist', messages: [], arrival: station };

// Local dialogue must never unlock the saved game, and reload must restore server location.
test('arrival restores server state, receives ticket from dialogue, and commits exit before entry', async () => {
  let saved = station;
  let finish;
  const exit = new Promise((resolve) => { finish = resolve; });
  const controller = createArrivalController({ load: async () => saved, start: async () => conversation,
    send: async () => { saved = ticket; return { playerMessage: { id: 'player', sender: 'player', text: 'ticket' }, npcMessage: { id: 'npc', sender: 'npc', text: 'Here you are' }, arrival: ticket }; },
    enter: async () => exit });
  assert.equal(await controller.load(), true);
  assert.equal(controller.getSnapshot().arrival.canEnterTownStreet, false);
  await controller.start();
  await controller.send('ticket');
  assert.equal(controller.getSnapshot().arrival.ticket.issued, true);
  const entering = controller.enter();
  assert.equal(controller.getSnapshot().arrival.locationId, 'loc_station');
  finish(street);
  assert.equal(await entering, true);
  assert.equal(controller.getSnapshot().arrival.locationId, 'loc_town_street');
  saved = street;
  await controller.load();
  assert.equal(controller.getSnapshot().arrival.rewardsGranted, true);
});

// Retrying a lost response with a new UUID would append/reward twice.
test('failed message preserves its UUID for retry, and failed exit does not change location', async () => {
  const bodies = [];
  let fail = true;
  const controller = createArrivalController({ load: async () => ticket, start: async () => ({ ...conversation, arrival: ticket }),
    send: async (_id, body) => { bodies.push(body); if (fail) throw new Error('Connection lost'); return { playerMessage: { id: 'p', sender: 'player', text: body.text }, npcMessage: { id: 'n', sender: 'npc', text: 'reply' }, arrival: ticket }; },
    enter: async () => { throw new Error('offline'); } });
  await controller.load(); await controller.start();
  assert.equal(await controller.send('hello'), false);
  assert.match(controller.getSnapshot().error, /Connection lost/);
  fail = false;
  assert.equal(await controller.send('hello'), true);
  assert.equal(bodies[0].clientMessageId, bodies[1].clientMessageId);
  assert.equal(await controller.enter(), false);
  assert.equal(controller.getSnapshot().arrival.locationId, 'loc_station');
});

// A detached scene must not receive private state from a late request.
test('disposed arrival controller ignores pending results', async () => {
  let finish;
  const controller = createArrivalController({ load: () => new Promise((resolve) => { finish = resolve; }) });
  const loading = controller.load();
  controller.dispose(); finish(street);
  await loading;
  assert.equal(controller.getSnapshot().arrival, null);
});

// An ordered-step rejection is definitive, so the learner must be able to correct the reply.
test('rejected out-of-order reply allows a different message, and overlapping sends are ignored', async () => {
  let reject = true;
  let calls = 0;
  const controller = createArrivalController({ load: async () => station, start: async () => conversation,
    send: async (_id, body) => { calls++; if (reject) throw Object.assign(new Error('Greet first'), { status: 409 }); return { playerMessage: { id: 'p', sender: 'player', text: body.text }, npcMessage: { id: 'n', sender: 'npc', text: 'Hello' }, arrival: station }; } });
  await controller.load(); await controller.start();
  assert.equal(await controller.send('ticket'), false);
  reject = false;
  const sent = controller.send('hello');
  assert.equal(await controller.send('hello'), false);
  assert.equal(await sent, true);
  assert.equal(calls, 2);
});
// Coach must be opt-in and remain stable when a message response is lost.
test('Coach feedback comes from the server and retries preserve the original Coach setting', async () => {
  const correction = { original: 'I need ticket', improved: 'I need a ticket.', reason: 'Use an article.', question: 'you need a ticket' };
  const bodies = [];
  let fail = true;
  const controller = createArrivalController({ load: async () => ticket, start: async () => conversation,
    send: async (_id, body) => { bodies.push(body); if (fail) throw new Error('Connection lost'); return { playerMessage: { id: 'p', sender: 'player', text: body.text }, npcMessage: { id: 'n', sender: 'npc', text: 'Here is your ticket' }, correction, arrival: ticket }; } });
  await controller.load(); await controller.start();
  assert.equal(await controller.send('I need ticket', true), false);
  assert.equal(bodies[0].coach, true);
  assert.equal(controller.getSnapshot().retryMessage.text, 'I need ticket');
  fail = false;
  assert.equal(await controller.send('I need ticket', true), true);
  assert.equal(bodies[0].clientMessageId, bodies[1].clientMessageId);
  assert.deepEqual(controller.getSnapshot().correction, correction);
  assert.equal(controller.getSnapshot().arrival.ticket.issued, true);
  assert.equal(controller.getSnapshot().retryMessage, null);
});
// Failed fetches need a useful recovery message rather than a browser-specific exception.
test('network failures explain how to retry without pretending progress was saved', async () => {
  const controller = createArrivalController({ load: async () => { throw new TypeError('Failed to fetch'); } });
  assert.equal(await controller.load(), false);
  assert.match(controller.getSnapshot().error, /connection.*retry/i);
  assert.equal(controller.getSnapshot().arrival, null);
});
