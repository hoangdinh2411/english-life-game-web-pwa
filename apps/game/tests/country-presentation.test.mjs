import assert from 'node:assert/strict';
import test from 'node:test';
import { countryLocationLabel, countryResidentHint, countryWelcomeLabel } from '../src/features/location/country-presentation.ts';

// Regression: a French Guiana character must never receive Sweden-only gameplay labels.
test('gameplay presentation uses the authenticated player country', () => {
  assert.equal(countryLocationLabel('French Guiana', 'station'), 'French Guiana · Train Station');
  assert.equal(countryLocationLabel('French Guiana', 'corner_cafe'), 'French Guiana · Corner Cup Café');
  assert.equal(countryWelcomeLabel('French Guiana'), 'Ruth · Welcome to French Guiana!');
  assert.equal(countryResidentHint('French Guiana'),
    'Try asking about the weather, hobbies, food or life in French Guiana.');
});

test('country presentation stays neutral when local practice has no selected country', () => {
  assert.equal(countryLocationLabel('', 'street'), 'Town Street');
  assert.equal(countryWelcomeLabel(undefined), 'Ruth · Welcome!');
  assert.equal(countryResidentHint(undefined),
    'Try asking about the weather, hobbies, food or life here.');
});
