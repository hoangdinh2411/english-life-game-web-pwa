import assert from 'node:assert/strict';
import test from 'node:test';
import { stationReply } from '../dist/index.js';
test('receptionist requests a greeting before directions and accepts imperfect English', () => {
  assert.equal(stationReply('npc_station_information', 0, 'I need ID card').step, 0);
  assert.equal(stationReply('npc_station_information', 0, 'Hello!').step, 1);
  const reply = stationReply('npc_station_information', 1, 'I need ID card');
  assert.equal(reply.directions, false);
  assert.equal(reply.text, 'Oh, you need an ID card?');
  assert.equal(reply.correction.improved, 'I need an ID card.');
  assert.equal(stationReply('npc_station_information', 1, '???').step, 1);
});
test('passengers never advance the receptionist exchange', () => {
  assert.equal(stationReply('npc_passenger_backpack', 0, 'where is the tax office?').directions, false);
  assert.equal(stationReply('npc_passenger_suitcase', 0, 'hello').step, 0);
});

test('grammar feedback recasts station phrases as questions and keeps original input', () => {
  for (const [input, improved, recast] of [
    ['I need ID card', 'I need an ID card.', 'You need an ID card'],
    ['I need a ID card.', 'I need an ID card.', 'You need an ID card'],
    ['I want get ID card', 'I want to get an ID card.', 'You want to get an ID card'],
    ['I want to get ID card', 'I want to get an ID card.', 'You want to get an ID card'],
    ['  Hello! I new here!  ', 'I am new here.', 'You are new here'],
    ['My journey good.', 'My journey was good.', 'Your journey was good'],
  ]) {
    const reply = stationReply('npc_passenger_backpack', 0, input);
    assert.equal(reply.correction.original, input.trim());
    assert.equal(reply.correction.improved, improved);
    assert.ok(reply.text.toLowerCase().includes(recast.toLowerCase()));
    assert.ok(reply.text.endsWith('?'));
    assert.equal(reply.directions, false);
  }
});

test('correct, unknown, negated, quoted and partial phrases are not corrected', () => {
  for (const input of ['I need an ID card.', 'I want to get an ID card.', 'I am new here.', 'My journey was good.', 'Good', 'I do not want get ID card', 'She said I need ID card', 'I need ID card and a ticket', '???']) {
    assert.equal(stationReply('npc_passenger_suitcase', 0, input).correction, undefined);
  }
});

test('players can answer a correction question without repeating their request', () => {
  const reply = stationReply('npc_station_information', 1, 'I want get ID card');
  assert.equal(reply.step, 1);
  assert.equal(reply.directions, false);
  const yes = stationReply('npc_station_information', reply.step, 'Yes, please.', reply.followUp);
  assert.ok(yes.text.includes('south path'));
  assert.equal(yes.correction, undefined);
  const no = stationReply('npc_station_information', reply.step, 'No, thank you.', reply.followUp);
  assert.ok(no.text.endsWith('?'));
  assert.equal(no.step, 1);
  assert.equal(stationReply('npc_passenger_backpack', 0, 'yes', 'directions').directions, false);
});
