import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCountryCatalog, parseCreateCharacterRequest, parseOnboardingOptions } from '../dist/onboarding.js';

// A permissive parser could let clients choose balances or reference arbitrary content.
test('creation accepts the minimal name and stable selections but rejects authority fields', () => {
  assert.deepEqual(parseCreateCharacterRequest({ name: 'Ánh', countryId: 'country_sweden', avatarId: 'avatar_traveler_01' }), {
    name: 'Ánh', countryId: 'country_sweden', avatarId: 'avatar_traveler_01',
  });
  assert.throws(() => parseCreateCharacterRequest({ name: 'Ánh', countryId: 'country_sweden', avatarId: 'avatar_traveler_01', xp: 500 }), /unexpected/i);
  assert.throws(() => parseCreateCharacterRequest({ name: '  ', countryId: 'country_sweden', avatarId: 'avatar_traveler_01' }), /name/i);
  assert.throws(() => parseCreateCharacterRequest({ name: 'Ánh', cityId: 'city_maplewood', avatarId: 'avatar_traveler_01' }), /unexpected/i);
});

// Malformed or duplicate catalogs must fail instead of presenting unstable selections.
test('onboarding catalog accepts Sweden without exposing the starter city', () => {
  const sweden = { id: 'country_sweden', name: 'Sweden', isoCode: 'SE', flag: '🇸🇪', timeZone: 'Europe/Stockholm' };
  assert.deepEqual(parseOnboardingOptions({ countries: [sweden], avatars: [{ id: 'avatar_traveler_01', label: 'Traveler', outfitColor: '#527b78' }] }).countries, [sweden]);
  assert.throws(() => parseOnboardingOptions({ countries: [sweden, sweden], avatars: [] }), /duplicate/i);
  assert.throws(() => parseOnboardingOptions({ countries: [{ ...sweden, starterCityId: 'city_maplewood' }], avatars: [] }), /unexpected/i);
});

test('country content validates ISO, IANA time zone and internal starter city', () => {
  const sweden = { id: 'country_sweden', name: 'Sweden', isoCode: 'SE', flag: '🇸🇪', timeZone: 'Europe/Stockholm', starterCityId: 'city_maplewood' };
  assert.deepEqual(parseCountryCatalog([sweden]), [sweden]);
  assert.throws(() => parseCountryCatalog([{ ...sweden, timeZone: 'Stockholm' }]), /time zone/i);
  assert.throws(() => parseCountryCatalog([{ ...sweden, isoCode: 'SWE' }]), /ISO/i);
});
