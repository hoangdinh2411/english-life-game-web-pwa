import assert from 'node:assert/strict';
import test from 'node:test';
import { canSubmitOnboarding, filterCountries, reconcileCountrySelection, StartLifeSubmission, validateCharacterName } from '../src/onboarding/onboarding-state.ts';

// Name errors should block the Continue action without imposing character-name policy.
test('submission requires an explicit country and the server-approved name format', () => {
  assert.equal(validateCharacterName('  '), 'Please enter a name.');
  assert.equal(validateCharacterName('A'), 'Use 2–20 letters. Spaces, apostrophes, and hyphens are allowed.');
  assert.equal(validateCharacterName('Ánh'), null);
  assert.equal(canSubmitOnboarding({ countryId: 'country_sweden', gender: 'female', name: 'Ánh' }), true);
  assert.equal(canSubmitOnboarding({ countryId: 'country_sweden', name: 'Ánh' }), false);
  assert.equal(canSubmitOnboarding({ name: 'Ánh' }), false);
});

// A rapid double tap must cause only one character creation request.
test('Start Life ignores a second submission while the first request is pending', async () => {
  const lock = new StartLifeSubmission();
  let calls = 0;
  let release;
  const first = lock.run(() => { calls += 1; return new Promise((resolve) => { release = resolve; }); });
  const second = await lock.run(async () => { calls += 1; return 'duplicate'; });
  assert.equal(second, null);
  assert.equal(calls, 1);
  release('created');
  assert.equal(await first, 'created');
});

// Replacing one choice on Back must preserve the other two selections.
test('country search is forgiving but edited text clears a stale selection', () => {
  const countries = [
    { id: 'country_sweden', name: 'Sweden', isoCode: 'SE', flag: '🇸🇪', timeZone: 'Europe/Stockholm' },
    { id: 'country_vietnam', name: 'Vietnam', isoCode: 'VN', flag: '🇻🇳', timeZone: 'Asia/Ho_Chi_Minh' },
  ];
  assert.deepEqual(filterCountries(countries, ' viet '), [countries[1]]);
  assert.equal(reconcileCountrySelection('Sweden', countries[0]), countries[0]);
  assert.equal(reconcileCountrySelection('Swed', countries[0]), null);
});
