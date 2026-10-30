import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { assertUniqueAssetIdentities, collectLocalMapAssets, executeAssetPlan, planAssetSync } from './sync-map-assets.mjs';

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

test('sync rejects duplicate logical identities before upload', () => {
  assert.throws(() => assertUniqueAssetIdentities([
    { key: 'sprite', npcId: 'npc_mia' },
    { key: 'sprite', npcId: 'npc_mia' },
  ]), /Duplicate local asset identity: npc_mia:sprite/);

  assert.doesNotThrow(() => assertUniqueAssetIdentities([
    { key: 'sprite', npcId: 'npc_mia' },
    { key: 'sprite', npcId: 'npc_noah' },
  ]));
});

test('immutable versions change only when the SHA-256 changes', () => {
  const remote = [{ key: 'background', npcId: null, sha256: 'a'.repeat(64), version: 7 }];
  assert.deepEqual(planAssetSync([{ key: 'background', sha256: 'a'.repeat(64) }], remote)[0].version, 7);
  assert.deepEqual(planAssetSync([{ key: 'background', sha256: 'b'.repeat(64) }], remote)[0].version, 8);
});

test('partial upload failure attempts every changed asset and retains successful immutable uploads', async () => {
  const attempted = [];
  await assert.rejects(executeAssetPlan([
    { key: 'background', action: 'upload' },
    { key: 'player', action: 'upload' },
    { key: 'animations', action: 'skip' },
  ], async asset => {
    attempted.push(asset.key);
    if (asset.key === 'background') throw new Error('fixture failure');
  }), /failed for map:background.*retained/);
  assert.deepEqual(attempted, ['background', 'player']);
});

test('local pack validation rejects missing and malformed runtime assets', async t => {
  const root = await mkdtemp(join(tmpdir(), 'life-assets-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const map = join(root, 'loc_cafe');
  await mkdir(map);
  await writeFile(join(map, 'player.png'), 'player');
  await writeFile(join(map, 'animations.json'), '{bad json');
  await assert.rejects(collectLocalMapAssets('loc_cafe', root), /Missing required asset: background.png/);
  await writeFile(join(map, 'background.png'), 'background');
  await assert.rejects(collectLocalMapAssets('loc_cafe', root), /animations.json must contain valid JSON/);
  await writeFile(join(map, 'animations.json'), JSON.stringify({ animations: [] }));
  await assert.rejects(collectLocalMapAssets('loc_cafe', root), /invalid walk-0 contract/);
});
