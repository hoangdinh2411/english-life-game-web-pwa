import assert from 'node:assert/strict';
import test from 'node:test';
import { runQuickRestTransition } from '../src/features/life/quick-rest-transition.ts';

test('quick rest starts only after success and blocks for five seconds between shorter fades', async () => {
  const events = [];
  const result = await runQuickRestTransition({
    request: async () => { events.push('success'); return 'saved'; },
    onPhase: phase => events.push(phase),
    wait: async milliseconds => { events.push(milliseconds); },
    reducedMotion: false,
  });
  assert.equal(result, 'saved');
  assert.deepEqual(events, ['success', 'darkening', 750, 'resting', 5000, 'waking', 750, null]);
});

test('server rejection never starts the transition', async () => {
  const phases = [];
  const waits = [];
  await assert.rejects(runQuickRestTransition({
    request: async () => { throw new Error('You are not tired yet.'); },
    onPhase: phase => phases.push(phase),
    wait: async milliseconds => { waits.push(milliseconds); },
    reducedMotion: false,
  }), /not tired/);
  assert.deepEqual(phases, []);
  assert.deepEqual(waits, []);
});

test('reduced motion shortens only fades, not the five-second rest', async () => {
  const waits = [];
  await runQuickRestTransition({
    request: async () => undefined,
    onPhase() {},
    wait: async milliseconds => { waits.push(milliseconds); },
    reducedMotion: true,
  });
  assert.deepEqual(waits, [100, 5000, 100]);
});
