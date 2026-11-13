import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  compileIntentLexicon, defineContextProfile, detectContextIntent, intentResultSchema,
} from '../dist/index.js';

const lexiconSource = JSON.parse(readFileSync(new URL('../src/dialogue/content/intent-lexicon.json', import.meta.url), 'utf8'));

const yesNo = defineContextProfile({ id: 'yes_no', allowedIntents: ['confirm', 'deny', 'cancel'] });
const field = defineContextProfile({
  id: 'address_field',
  allowedIntents: ['not_available', 'unknown', 'provide_later', 'cancel'],
  bareWords: { no: 'not_available', nope: 'not_available' },
  topicAliases: { address: ['address'] },
});

const matched = (primary, modifiers = []) => ({ status: 'matched', primary, modifiers });
const unclear = (reason) => ({ status: 'unclear', reason });

test('yes/no profile resolves confirmations, denials and cancellation', () => {
  for (const input of ['yes', 'Yes!', 'Yes, please', 'Sure', 'ok', 'Exactly', 'Yes, issue my card', 'That is right']) {
    assert.deepEqual(detectContextIntent(input, yesNo), matched('confirm'), input);
  }
  for (const input of ['no', 'No thanks', 'nope', 'not really', "I don't need an ID card", 'That is not right']) {
    assert.deepEqual(detectContextIntent(input, yesNo), matched('deny'), input);
  }
  for (const input of ['cancel', 'Please cancel it', 'never mind', 'forget it', 'I want to cancel this']) {
    assert.deepEqual(detectContextIntent(input, yesNo), matched('cancel'), input);
  }
});

test('field profile resolves the required learner phrases', () => {
  assert.deepEqual(detectContextIntent('no', field), matched('not_available'));
  assert.deepEqual(detectContextIntent("I don't know", field), matched('unknown'));
  assert.deepEqual(detectContextIntent('not sure', field), matched('unknown'));
  assert.deepEqual(detectContextIntent("Sorry, I don't have any address right now", field), matched('not_available'));
  assert.deepEqual(detectContextIntent("I don't have one, but I'll provide it later", field), matched('not_available', ['provide_later']));
  assert.deepEqual(detectContextIntent('I will bring it tomorrow', field), matched('provide_later'));
  assert.deepEqual(detectContextIntent('cancel', field), matched('cancel'));
});

test('learner-error variants are accepted', () => {
  for (const input of ['I no have address', 'I dont have address', 'no address', 'I have no address', 'i not have address']) {
    assert.deepEqual(detectContextIntent(input, field), matched('not_available'), input);
  }
  assert.deepEqual(detectContextIntent('I dont know', field), matched('unknown'));
  assert.deepEqual(detectContextIntent('no idea', field), matched('unknown'));
});

test('the same words resolve differently under different profiles', () => {
  assert.deepEqual(detectContextIntent('no', yesNo), matched('deny'));
  assert.deepEqual(detectContextIntent('no', field), matched('not_available'));
  // "cancel" is not accepted by a profile that does not list it.
  const confirmOnly = defineContextProfile({ id: 'confirm_only', allowedIntents: ['confirm', 'deny'] });
  assert.deepEqual(detectContextIntent('cancel', confirmOnly), unclear('no_match'));
  // A later clause outside the profile is dropped, the allowed answer still counts.
  const notAvailableOnly = defineContextProfile({ id: 'only_missing', allowedIntents: ['not_available'] });
  assert.deepEqual(detectContextIntent("I don't have one, but I'll provide it later", notAvailableOnly), matched('not_available'));
});

test('a test-only profile works with data alone', () => {
  const phone = defineContextProfile({
    id: 'phone_question',
    allowedIntents: ['not_available', 'unknown'],
    bareWords: { nothing: 'unknown' },
    topicAliases: { phone: ['cell', 'cell number'] },
  });
  assert.deepEqual(detectContextIntent("I don't have a cell number", phone), matched('not_available'));
  assert.deepEqual(detectContextIntent('nothing', phone), matched('unknown'));
  assert.deepEqual(detectContextIntent("I don't have a cell number", field), unclear('no_match'));
});

test('contradictory, unsupported or empty wording is unclear', () => {
  assert.deepEqual(detectContextIntent('yes and no', yesNo), unclear('conflicting'));
  assert.deepEqual(detectContextIntent('yes, but cancel', yesNo), unclear('conflicting'));
  assert.deepEqual(detectContextIntent('banana', yesNo), unclear('no_match'));
  assert.deepEqual(detectContextIntent('yes, but I like tea', yesNo), unclear('no_match'));
  assert.deepEqual(detectContextIntent('', yesNo), unclear('no_match'));
  assert.deepEqual(detectContextIntent('   ...  ', yesNo), unclear('no_match'));
  assert.deepEqual(detectContextIntent('maybe', yesNo), unclear('no_match'));
});

test('a clause matching two allowed intents is ambiguous', () => {
  // An alias can make one clause fit two phrases; the detector refuses to guess.
  const clash = defineContextProfile({
    id: 'clash',
    allowedIntents: ['not_available', 'unknown'],
    topicAliases: { address: ['idea'] },
  });
  assert.deepEqual(detectContextIntent("I don't have idea", clash), unclear('ambiguous'));
  assert.deepEqual(detectContextIntent("I don't have idea", field), matched('unknown'));
});

test('every result satisfies the strict contract', () => {
  for (const input of ['yes', "I don't have one, but I'll provide it later", 'yes and no', '', 'x']) {
    for (const profile of [yesNo, field]) {
      assert.doesNotThrow(() => intentResultSchema.parse(detectContextIntent(input, profile)), input);
    }
  }
});

test('the detector is pure and rejects invalid profiles', () => {
  const first = detectContextIntent('Yes', yesNo);
  assert.deepEqual(detectContextIntent('Yes', yesNo), first);
  assert.throws(() => detectContextIntent('yes', { id: 'bad', allowedIntents: [] }));
});

test('lexicon validation reports syntax, empty, duplicate, unknown intent and topic problems', () => {
  const withPhrases = (...phrases) => ({ ...lexiconSource, phrases });
  const fails = (source, pattern) => assert.throws(() => compileIntentLexicon(source), pattern);

  assert.doesNotThrow(() => compileIntentLexicon(lexiconSource));
  fails(withPhrases({ intent: 'confirm', mode: 'literal', patterns: ['(yes'] }), /unbalanced/);
  fails(withPhrases({ intent: 'confirm', mode: 'literal', patterns: ['(please)'] }), /no required word/);
  fails(withPhrases({ intent: 'confirm', mode: 'literal', patterns: ['yes', 'yes|yeah'] }), /duplicate phrase "yes"/);
  fails(withPhrases({ intent: 'confirm', mode: 'literal', patterns: ['yes'] }, { intent: 'deny', mode: 'literal', patterns: ['yes'] }), /duplicate phrase/);
  fails(withPhrases({ intent: 'greet', mode: 'literal', patterns: ['hello'] }), /Invalid option/i);
  fails(withPhrases({ intent: 'confirm', mode: 'literal', patterns: ['it is {colour}'] }), /unknown topic \{colour\}/);
  fails(withPhrases({ intent: 'confirm', mode: 'literal', patterns: ['Yes!'] }), /invalid token/);
  fails(withPhrases({ intent: 'confirm', mode: 'literal', patterns: ['please yes'] }), /filler/);
  fails(withPhrases({ intent: 'deny', mode: 'negated', patterns: ['no way'] }), /negation/);
  fails({ ...lexiconSource, compatible: [['confirm', 'greet']] }, /compatible/);
});
