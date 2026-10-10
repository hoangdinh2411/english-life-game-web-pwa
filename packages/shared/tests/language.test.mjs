import assert from 'node:assert/strict';
import test from 'node:test';
import { checkGrammar, detectIntent, stationReply } from '../dist/index.js';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const station = require('../src/dialogue/content/intents.station.json');

test('common intents are reusable and confirmation requires context', () => {
  assert.equal(detectIntent('Exactly'), undefined);
  for (const input of ['Yes, please', 'Exactly', 'Sure', 'That’s right', 'I need it for a bank account']) assert.equal(detectIntent(input, true).id, 'confirm');
  assert.equal(detectIntent('Hello').id, 'greet');
  assert.equal(detectIntent('I don’t need an ID card', true, station.intents).id, 'deny');
  assert.deepEqual(detectIntent('Where is the cafe?', false, station.intents).slots, { place: 'cafe' });
  const custom = [{ id: 'order_drink', pattern: '\\bcoffee\\b' }];
  assert.equal(detectIntent('Coffee, please', false, custom).id, 'order_drink');
});

test('grammar transforms player wording across domains and composes rules', () => {
  assert.equal(checkGrammar('I want open a bank account').improved, 'I want to open a bank account.');
  assert.equal(checkGrammar('I want buy coffee').improved, 'I want to buy coffee.');
  const feedback = checkGrammar('I want get ID card');
  assert.equal(feedback.improved, 'I want to get an ID card.');
  assert.equal(feedback.question, 'you want to get an ID card');
  assert.equal(checkGrammar('I want to get an ID card'), undefined);
});

test('different document requests and follow-up answers reach the same meaning', () => {
  for (const input of ['I need an ID card', 'How can I get an identity card?', 'I’d like to apply for an ID card']) {
    assert.equal(stationReply('npc_station_information', 1, input).directions, true);
  }
  for (const input of ['Yes', 'Exactly', 'Sure', 'I need it to open a bank account']) {
    assert.equal(stationReply('npc_station_information', 1, input, 'directions').directions, true);
  }
  assert.equal(stationReply('npc_station_information', 1, 'I do not need an ID card').directions, false);
  assert.equal(stationReply('npc_station_information', 1, 'Where is the cafe?', 'directions').directions, false);
  assert.equal(stationReply('npc_station_information', 0, 'Hello! I new here').step, 1);
  assert.equal(stationReply('npc_station_information', 1, 'Hello! I need ID card').followUp, 'directions');
  assert.equal(stationReply('npc_station_information', 1, 'Where is the cafe?', 'directions').followUp, undefined);
});
