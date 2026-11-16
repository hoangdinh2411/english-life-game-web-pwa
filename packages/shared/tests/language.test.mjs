import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checkGrammar,
  detectContextIntent,
  detectIntent,
  endsWithFarewell,
  FAREWELL_PROFILE,
  SOCIAL_INTENT_PROFILE,
  STATION_OPEN_PROFILE,
  STATION_QUESTION_PROFILE,
  stationReply,
} from '../dist/index.js';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const station = require('../src/dialogue/content/intents.station.json');

test('common intents are reusable via ContextProfiles and detectIntent handles only domain entity rules', () => {
  assert.equal(detectIntent('Exactly'), undefined);
  assert.equal(detectIntent('Hello'), undefined);
  assert.equal(detectContextIntent('Exactly', STATION_OPEN_PROFILE).status, 'unclear');
  for (const input of ['Yes, please', 'Exactly', 'Sure', 'That’s right', 'I need it for a bank account']) {
    const decision = detectContextIntent(input, STATION_QUESTION_PROFILE);
    assert.equal(decision.status === 'matched' ? decision.primary : undefined, 'confirm', input);
  }
  const greeted = detectContextIntent('Hello', SOCIAL_INTENT_PROFILE);
  assert.equal(greeted.status === 'matched' ? greeted.primary : undefined, 'greet');
  const denied = detectContextIntent('I don’t need an ID card', STATION_QUESTION_PROFILE);
  assert.equal(denied.status === 'matched' ? denied.primary : undefined, 'deny');
  assert.deepEqual(detectIntent('Where is the cafe?', station.intents).slots, { place: 'cafe' });
  const custom = [{ id: 'order_drink', pattern: '\\bcoffee\\b' }];
  assert.equal(detectIntent('Coffee, please', custom).id, 'order_drink');
});

test('farewell intent recognizes natural endings without matching questions about farewells', () => {
  const isFarewell = (input) => {
    const decision = detectContextIntent(input, FAREWELL_PROFILE);
    return decision.status === 'matched' && (decision.primary === 'goodbye' || decision.modifiers.includes('goodbye'));
  };
  for (const input of [
    'Bye', 'Good bye!', 'Goodbye', 'Bye bye', 'See you later', 'See you soon',
    'Talk to you later', 'Catch you later', 'Take care', 'Have a nice day',
    'Have a good day', 'Until next time', 'Farewell', 'I have to go',
    'I need to go now', 'I should get going', 'Let’s talk later',
    'We talk later', "We'll talk later", 'We can talk later',
    'Nice talking to you', 'It was nice talking to you', 'Thanks for chatting',
  ]) assert.equal(isFarewell(input), true, input);

  for (const input of ['How do I say goodbye?', 'Will you see your friend later?', 'I need to go to the bank']) {
    assert.equal(isFarewell(input), false, input);
  }
  assert.equal(endsWithFarewell('Okay, no thanks. Goodbye:'), true);
  assert.equal(endsWithFarewell('Goodbye. Will you come back tomorrow?'), false);
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
