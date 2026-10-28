import assert from 'node:assert/strict';
import test from 'node:test';
import { planAssetSync } from './sync-map-assets.mjs';

test('sync uploads only missing or changed assets and increments changed versions', () => {
  const local = [
    { key: 'background', npcId: undefined, sha256: 'a'.repeat(64) },
    { key: 'actors', npcId: undefined, sha256: 'b'.repeat(64) },
    { key: 'portrait-npc_mia', npcId: 'npc_mia', sha256: 'c'.repeat(64) },
  ];
  const remote = [
    { key: 'background', npcId: null, sha256: 'a'.repeat(64), version: 3 },
    { key: 'actors', npcId: null, sha256: 'd'.repeat(64), version: 4 },
  ];

  assert.deepEqual(planAssetSync(local, remote).map(({ action, version }) => ({ action, version })), [
    { action: 'skip', version: 3 },
    { action: 'update', version: 5 },
    { action: 'upload', version: 1 },
  ]);
});
