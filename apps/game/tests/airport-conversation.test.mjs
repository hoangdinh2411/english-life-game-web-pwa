import assert from 'node:assert/strict';
import test from 'node:test';
import { createAirportSendHandler, matchCountry } from '../src/features/npcs/airport-country.ts';

const COUNTRIES = [
  { id: 'se', name: 'Sweden' },
  { id: 'jp', name: 'Japan' },
  { id: 'gb', name: 'United Kingdom' },
  { id: 'kr', name: 'South Korea' },
  { id: 'om', name: 'Oman' },
  { id: 'pg', name: 'Papua New Guinea' },
  { id: 'gn', name: 'Guinea' },
];

test('matchCountry matches exact, substring, and multi-word country names without false positives', () => {
  assert.deepEqual(matchCountry('Sweden', COUNTRIES), { id: 'se', name: 'Sweden' });
  assert.deepEqual(matchCountry('sweden', COUNTRIES), { id: 'se', name: 'Sweden' });
  assert.deepEqual(matchCountry('I want to fly to Japan please!', COUNTRIES), { id: 'jp', name: 'Japan' });
  assert.deepEqual(matchCountry("I'm moving to the United Kingdom.", COUNTRIES), { id: 'gb', name: 'United Kingdom' });
  assert.deepEqual(matchCountry('Flying to Papua New Guinea next week', COUNTRIES), { id: 'pg', name: 'Papua New Guinea' });
  assert.equal(matchCountry('Hello Claire, how are you?', COUNTRIES), undefined);
  assert.equal(matchCountry('I am a woman traveling alone', COUNTRIES), undefined);
  assert.equal(matchCountry('   ', COUNTRIES), undefined);
});

test('createAirportSendHandler locks destination country before sending conversation message', async () => {
  const events = [];
  let locked = false;

  const sendHandler = createAirportSendHandler({
    getCountries: () => COUNTRIES,
    loadCountries: async () => {
      events.push('loadCountries');
      return COUNTRIES;
    },
    isDestinationLocked: () => locked,
    lockCountry: async (countryId) => {
      events.push(`lockCountry:${countryId}`);
      locked = true;
    },
    onRefresh: async () => {
      events.push('onRefresh');
    },
    onDestinationSelected: () => {
      events.push('onDestinationSelected');
    },
    send: async (text) => {
      events.push(`send:${text}`);
      return true;
    },
  });

  await sendHandler('Hello!');
  assert.deepEqual(events, ['send:Hello!']);

  events.length = 0;
  await sendHandler('I am flying to Sweden');
  assert.deepEqual(events, [
    'lockCountry:se',
    'onRefresh',
    'onDestinationSelected',
    'send:I am flying to Sweden',
  ]);

  events.length = 0;
  await sendHandler('Actually Japan');
  assert.deepEqual(events, ['send:Actually Japan']);
});

test('createAirportSendHandler loads countries lazily when cache is initially empty', async () => {
  const events = [];
  let cached = [];

  const sendHandler = createAirportSendHandler({
    getCountries: () => cached,
    loadCountries: async () => {
      events.push('loadCountries');
      cached = COUNTRIES;
      return cached;
    },
    isDestinationLocked: () => false,
    lockCountry: async (countryId) => {
      events.push(`lockCountry:${countryId}`);
    },
    onRefresh: async () => {
      events.push('onRefresh');
    },
    onDestinationSelected: () => {
      events.push('onDestinationSelected');
    },
    send: async (text) => {
      events.push(`send:${text}`);
      return true;
    },
  });

  await sendHandler('United Kingdom');
  assert.deepEqual(events, [
    'loadCountries',
    'lockCountry:gb',
    'onRefresh',
    'onDestinationSelected',
    'send:United Kingdom',
  ]);
});

test('createAirportSendHandler still sends message when server reports destination country is already locked (409)', async () => {
  const events = [];

  const sendHandler = createAirportSendHandler({
    getCountries: () => COUNTRIES,
    loadCountries: async () => COUNTRIES,
    isDestinationLocked: () => false,
    lockCountry: async () => {
      const error = new Error('Destination country is already locked');
      Object.assign(error, { status: 409 });
      throw error;
    },
    onRefresh: async () => {
      events.push('onRefresh');
    },
    onDestinationSelected: () => {
      events.push('onDestinationSelected');
    },
    send: async (text) => {
      events.push(`send:${text}`);
      return true;
    },
  });

  const sent = await sendHandler('Japan');
  assert.equal(sent, true);
  assert.deepEqual(events, ['onDestinationSelected', 'send:Japan']);
});
