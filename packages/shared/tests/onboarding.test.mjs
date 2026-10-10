import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCreateCharacterRequest, parseOnboardingOptions } from '../dist/onboarding.js';

// A permissive parser could let clients choose balances or reference arbitrary content.
test('creation accepts the minimal name and stable selections but rejects authority fields', () => {
  assert.deepEqual(parseCreateCharacterRequest({ name: 'Ánh', cityId: 'city_maplewood', avatarId: 'avatar_traveler_01' }), {
    name: 'Ánh', cityId: 'city_maplewood', avatarId: 'avatar_traveler_01',
  });
  assert.throws(() => parseCreateCharacterRequest({ name: 'Ánh', cityId: 'city_maplewood', avatarId: 'avatar_traveler_01', xp: 500 }), /unexpected/i);
  assert.throws(() => parseCreateCharacterRequest({ name: '  ', cityId: 'city_maplewood', avatarId: 'avatar_traveler_01' }), /name/i);
});

// Malformed or duplicate catalogs must fail instead of presenting unstable selections.
test('onboarding catalog accepts Maplewood and rejects duplicate ids', () => {
  assert.equal(parseOnboardingOptions({ cities: [{ id: 'city_maplewood', name: 'Maplewood' }], avatars: [{ id: 'avatar_traveler_01', label: 'Traveler', outfitColor: '#527b78' }] }).cities.length, 1);
  assert.throws(() => parseOnboardingOptions({ cities: [{ id: 'city_maplewood', name: 'Maplewood' }, { id: 'city_maplewood', name: 'Other' }], avatars: [] }), /duplicate/i);
});
