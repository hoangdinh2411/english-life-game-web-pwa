import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { appearanceSignature } from '../src/features/appearance/appearance-signature.ts';
import { shouldRefreshAfterLifeAction } from '../src/features/life/life-action-refresh.ts';

test('sleep uses its authoritative response without a second life refresh', () => {
  assert.equal(shouldRefreshAfterLifeAction({ path: 'sleep', body: { key: randomUUID() } }), false);
  assert.equal(shouldRefreshAfterLifeAction({ path: 'appearance', body: { key: randomUUID(), hair: 'black' } }), true);
});

test('equivalent appearance objects do not request another Phaser texture repaint', () => {
  const before = { hair: 'brown', shirt: 'red', trousers: 'navy' };
  const afterSleep = { ...before };
  assert.notEqual(before, afterSleep);
  assert.equal(appearanceSignature(before), appearanceSignature(afterSleep));
  assert.notEqual(appearanceSignature(before), appearanceSignature({ ...before, shirt: 'blue' }));
});
