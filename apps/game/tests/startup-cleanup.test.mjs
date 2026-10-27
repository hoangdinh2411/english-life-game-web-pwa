import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWithoutWaitingForCleanup } from '../src/features/station/startup-cleanup.ts';

test('unresolved transient cleanup never blocks authenticated map startup', async () => {
  const completed = [];
  const result = await loadWithoutWaitingForCleanup(
    async () => { completed.push('map load'); return 'loaded'; },
    [() => new Promise(() => undefined)],
  );
  assert.equal(result, 'loaded');
  assert.deepEqual(completed, ['map load']);
});
