import assert from 'node:assert/strict';
import test from 'node:test';
import { notifyAiFallback } from '../src/gameplay/ai-fallback.ts';
test('AI placeholder emits only safe context and makes no request', () => {
  const calls = [];
  notifyAiFallback({ npcId: 'npc_station_information', step: 1, text: 'Private player message' }, (...args) => calls.push(args));
  assert.deepEqual(calls, [['[dialogue] AI fallback requested (not connected)', { npcId: 'npc_station_information', step: 1, reason: 'no_script_match' }]]);
  assert.ok(!JSON.stringify(calls).includes('Private player message'));
});
