import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCountryCatalog, parseCreateCharacterRequest, parseOnboardingOptions } from '../dist/onboarding.js';

// A permissive parser could let clients choose server-owned setup state or save malformed names.
test('creation normalizes valid Unicode names and rejects every server-owned field', () => {
  assert.deepEqual(parseCreateCharacterRequest({ name: '  A\u030Ang-Marie O\'Neil  ', countryId: 'country_sweden' }), {
    name: "Ång-Marie O'Neil", countryId: 'country_sweden',
  });
  for (const field of ['avatarId', 'worldId', 'clockRate', 'clockStartUtc', 'starterCityId', 'starterLocationId', 'energy']) {
    assert.throws(() => parseCreateCharacterRequest({ name: 'Ánh', countryId: 'country_sweden', [field]: 'forged' }), /unexpected/i);
  }
});

test('creation requires a 2-20 character name with single approved separators', () => {
  for (const name of ['', 'A', 'A'.repeat(21), 'Anne  Marie', '-Anne', 'Anne-', 'Anne–Marie', 'Anne\tMarie', 'R2 D2']) {
    assert.throws(() => parseCreateCharacterRequest({ name, countryId: 'country_sweden' }), /name/i);
  }
  assert.deepEqual(parseCreateCharacterRequest({ name: '李 明', countryId: 'country_china' }), { name: '李 明', countryId: 'country_china' });
  assert.throws(() => parseCreateCharacterRequest({ name: 'Anne', countryId: 'missing' }), /country/i);
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
