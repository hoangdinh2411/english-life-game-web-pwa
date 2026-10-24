import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveRoute } from '../src/navigation/route-policy.ts';

test('direct protected links require a session; public practice does not', () => {
  const anonymous = { token: null, hasCharacter: false, online: true };
  for (const path of ['/', '/home', '/new-game', '/new-game/review']) assert.equal(resolveRoute(path, anonymous), '/sign-in');
  assert.equal(resolveRoute('/practice', anonymous), '/practice');
});
test('resumed characters go home and new accounts have one onboarding route', () => {
  const signedIn = { token: 'current-token', hasCharacter: false, online: true };
  assert.equal(resolveRoute('/new-game', signedIn), '/new-game');
  for (const path of ['/', '/home', '/sign-in', '/unknown', '/new-game/country', '/new-game/avatar', '/new-game/name', '/new-game/review']) assert.equal(resolveRoute(path, signedIn), '/new-game');
  assert.equal(resolveRoute('/new-game/review', { ...signedIn, hasCharacter: true }), '/home');
  assert.equal(resolveRoute('/practice', { ...signedIn, hasCharacter: true }), '/practice');
});
test('offline launch offers practice without claiming a saved character; sign-in explains connectivity', () => {
  const offline = { token: 'expired-token', hasCharacter: false, online: false };
  assert.equal(resolveRoute('/home', offline), '/practice');
  assert.equal(resolveRoute('/', offline), '/practice');
  assert.equal(resolveRoute('/sign-in', offline), '/sign-in');
  assert.equal(resolveRoute('/practice', { ...offline, online: true }), '/practice');
});
// Going offline during chat must not discard the authenticated conversation or draft.
test('an already loaded saved game stays home offline so it can show errors and reconnect', () => {
  assert.equal(resolveRoute('/home', { token: 'current-token', hasCharacter: true, online: false }), '/home');
});
