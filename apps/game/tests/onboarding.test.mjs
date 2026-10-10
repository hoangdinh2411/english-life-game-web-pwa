import assert from 'node:assert/strict';
import test from 'node:test';
import { canReview, StartLifeSubmission, validateCharacterName, mergeOnboardingDraft } from '../src/onboarding/onboarding-state.ts';

// Name errors should block the Continue action without imposing character-name policy.
test('review requires all selections and a minimally nonblank name', () => {
  assert.equal(validateCharacterName('  '), 'Please enter a name.');
  assert.equal(validateCharacterName('Ánh'), null);
  assert.equal(canReview({ cityId: 'city_maplewood', avatarId: 'avatar_traveler_01', name: 'Ánh' }), true);
  assert.equal(canReview({ avatarId: 'avatar_traveler_01', name: 'Ánh' }), false);
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
test('editing a selection keeps the remaining review choices', () => {
  const name = 'Ánh';
  const draft = mergeOnboardingDraft({ cityId: 'city_maplewood', avatarId: 'avatar_traveler_01', name }, { avatarId: 'avatar_traveler_02' });
  assert.deepEqual(draft, { cityId: 'city_maplewood', avatarId: 'avatar_traveler_02', name });
  assert.equal(canReview(draft), true);
});
