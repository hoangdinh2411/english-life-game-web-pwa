import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONTEXT_INTENT_IDS, contextProfileSchema, defineContextProfile, detectIntent, farewellClosing,
  intentResultSchema, isIdCardConfirmation, serviceContinuationIntent, stationReply,
} from '../dist/index.js';

// T40.a characterization: records today's behavior of the legacy matchers so the
// later migration (T40.c, T41) must change each transition deliberately.

test('detectIntent: confirm only exists with confirmation context; deny/goodbye/greet/thank do not', () => {
  const plain = (input) => detectIntent(input)?.id;
  const asked = (input) => detectIntent(input, true)?.id;
  for (const input of ['yes', 'Yes, please', 'Exactly', 'Sure', 'Yes, issue my card', 'yes, but change it']) {
    assert.equal(plain(input), undefined, input);
    assert.equal(asked(input), 'confirm', input);
  }
  for (const input of ['no', 'No thanks', 'not really', "I don't need an ID card", 'No, but I need to change my photo']) {
    assert.equal(plain(input), 'deny', input);
    assert.equal(asked(input), 'deny', input);
  }
  assert.equal(plain('Hello'), 'greet');
  assert.equal(plain('thanks'), 'thank');
  assert.equal(plain('Goodbye'), 'goodbye');
  // Known gaps in the legacy matcher: no cancel, unknown, not_available or provide_later,
  // and "nope", "ok" and "okay" are not recognised.
  for (const input of ['nope', 'ok', 'okay', 'cancel', "I don't know", 'maybe',
    "Sorry, I don't have any address right now", "I don't have one, but I'll provide it later"]) {
    assert.equal(asked(input), undefined, input);
  }
});

test('serviceContinuationIntent: finish, continue and unclear transitions', () => {
  for (const input of ['no', 'No thanks', 'thanks', 'Thank you very much', 'Nothing else', "That's all", "I'm done", 'Goodbye']) {
    assert.equal(serviceContinuationIntent(input), 'finish', input);
  }
  for (const input of ['yes', 'Sure', 'I need to change my address', 'No, but I need to change my photo', 'maybe', 'nope']) {
    assert.equal(serviceContinuationIntent(input), 'continue', input);
  }
  assert.equal(serviceContinuationIntent(''), 'unclear');
  assert.equal(serviceContinuationIntent('   '), 'unclear');
});

test('farewellClosing: yes-like, no-like and any other answer', () => {
  const yes = 'That would be lovely. I hope to see you tomorrow. Goodbye!';
  const no = 'I understand. It was nice talking with you. Goodbye!';
  const other = 'I hope to see you again. It was nice talking with you. Goodbye!';
  for (const input of ['Yes, I will', 'I think so']) assert.equal(farewellClosing(input), yes, input);
  for (const input of ['No', 'Probably not']) assert.equal(farewellClosing(input), no, input);
  assert.equal(farewellClosing('maybe'), other);
});

test('isIdCardConfirmation: exact phrases only, no negation, no partial matches', () => {
  for (const input of ['yes', 'Yes, please', 'Yes issue my card!', 'Yes, issue my card', 'correct', 'That is correct']) {
    assert.equal(isIdCardConfirmation(input), true, input);
  }
  for (const input of ['no', 'Sure', 'Exactly', 'ok', 'yes, but change it', 'yes change my name', 'not correct', '']) {
    assert.equal(isIdCardConfirmation(input), false, input);
  }
});

test('station receptionist follow-up: yes/no to the directions question and unclear answers', () => {
  const reply = (step, input, followUp) => stationReply('npc_station_information', step, input, followUp);
  assert.deepEqual([reply(1, 'Yes', 'directions').step, reply(1, 'Yes', 'directions').directions], [2, true]);
  assert.deepEqual([reply(1, 'No', 'directions').step, reply(1, 'No', 'directions').directions], [1, false]);
  assert.equal(reply(1, 'No', 'directions').text, 'Of course! What would you like help with instead?');
  const unclear = reply(1, 'maybe', 'directions');
  assert.deepEqual([unclear.step, unclear.directions, unclear.followUp, unclear.aiFallback], [1, false, 'directions', true]);
  assert.equal(reply(1, 'I need an ID card').directions, true);
});

test('intent contract accepts matched and unclear results and rejects malformed ones', () => {
  assert.deepEqual([...CONTEXT_INTENT_IDS], ['confirm', 'deny', 'cancel', 'unknown', 'not_available', 'provide_later']);
  const ok = intentResultSchema.parse({ status: 'matched', primary: 'not_available', modifiers: ['provide_later'] });
  assert.equal(ok.primary, 'not_available');
  assert.deepEqual(intentResultSchema.parse({ status: 'matched', primary: 'confirm', modifiers: [] }).modifiers, []);
  for (const reason of ['no_match', 'ambiguous', 'conflicting']) {
    assert.equal(intentResultSchema.parse({ status: 'unclear', reason }).reason, reason);
  }
  for (const bad of [
    { status: 'matched', primary: 'greet', modifiers: [] },
    { status: 'matched', primary: 'confirm', modifiers: ['goodbye'] },
    { status: 'matched', primary: 'deny', modifiers: ['cancel', 'cancel'] },
    { status: 'matched', primary: 'deny', modifiers: ['deny'] },
    { status: 'matched', primary: 'deny' },
    { status: 'matched', primary: 'deny', modifiers: [], extra: true },
    { status: 'unclear', reason: 'other' },
    { status: 'unclear' },
    { status: 'unclear', reason: 'no_match', primary: 'deny' },
    { status: 'maybe' },
  ]) assert.equal(intentResultSchema.safeParse(bad).success, false, JSON.stringify(bad));
});

test('context profile is data only, defaults AI off and rejects invalid profiles', () => {
  const profile = defineContextProfile({
    id: 'yes_no_question', allowedIntents: ['confirm', 'deny'], bareWords: { no: 'deny' },
  });
  assert.equal(profile.aiFallback, false);
  const field = defineContextProfile({
    id: 'address_field', allowedIntents: ['not_available', 'provide_later', 'cancel'], bareWords: { no: 'not_available' },
    topicAliases: { address: ['address', 'home'] }, aiFallback: true,
  });
  assert.equal(field.aiFallback, true);
  assert.deepEqual(field.topicAliases, { address: ['address', 'home'] });
  const valid = { id: 'p', allowedIntents: ['confirm'] };
  for (const bad of [
    { ...valid, allowedIntents: [] },
    { id: 'p' },
    { ...valid, allowedIntents: ['confirm', 'unsure'] },
    { ...valid, allowedIntents: ['confirm', 'confirm'] },
    { ...valid, id: '' },
    { ...valid, id: 'Bad Id' },
    { ...valid, bareWords: { no: 'deny' } },
    { ...valid, bareWords: { '': 'confirm' } },
    { ...valid, bareWords: { yes: 'unsure' } },
    { ...valid, topicAliases: { address: [] } },
    { ...valid, topicAliases: { address: [' '] } },
    { ...valid, topicAliases: { 'Bad Topic': ['x'] } },
    { ...valid, aiFallback: 'yes' },
    { ...valid, extra: true },
  ]) assert.equal(contextProfileSchema.safeParse(bad).success, false, JSON.stringify(bad));
  assert.throws(() => defineContextProfile({ id: 'p', allowedIntents: [] }));
});
