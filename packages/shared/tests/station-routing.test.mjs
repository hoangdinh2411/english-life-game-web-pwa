import assert from 'node:assert/strict';
import test from 'node:test';
import { stationReply } from '../dist/index.js';
test('unknown messages and unsupported recognized topics request AI without advancing', () => {
  for (const input of ['Do you like astronomy?', 'Where is the bank?', 'Tell me about Sweden']) {
    const reply = stationReply('npc_station_information', 1, input, 'directions');
    assert.equal(reply.aiFallback, true);
    assert.equal(reply.step, 1);
    assert.equal(reply.directions, false);
    assert.equal(reply.followUp, input === 'Where is the bank?' ? undefined : 'directions');
  }
  assert.equal(stationReply('npc_station_information', 0, 'What is your favorite movie?').aiFallback, true);
});
test('scripted topics, grammar recasts and current-question answers stay local', () => {
  for (const input of ['Hello', 'I need an ID card', 'I want get ID card', 'Where is the tax office?', 'Thanks']) {
    assert.equal(stationReply('npc_station_information', 1, input).aiFallback, undefined);
  }
  assert.equal(stationReply('npc_station_information', 1, 'yes').aiFallback, true);
  assert.equal(stationReply('npc_station_information', 1, 'yes', 'directions').aiFallback, undefined);
  assert.equal(stationReply('npc_passenger_backpack', 0, 'yes').aiFallback, undefined);
  for (const input of ['It was good.', 'A little tiring.', 'Good, thank you.']) assert.equal(stationReply('npc_passenger_suitcase', 0, input).aiFallback, undefined);
  assert.equal(stationReply('npc_station_information', 0, 'I need ID card').aiFallback, undefined);
});
