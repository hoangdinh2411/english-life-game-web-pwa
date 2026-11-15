import assert from 'node:assert/strict';
import test from 'node:test';
import * as assetSync from './sync-map-assets.mjs';

const { assertUniqueAssetIdentities, planAssetSync } = assetSync;

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

test('sync collapses duplicate asset sources when their content hashes match', () => {
  const deduplicate = assetSync.deduplicateIdenticalAssets;
  assert.equal(typeof deduplicate, 'function', 'identical source copies need a normalization step');

  const primary = {
    key: 'backpack-portrait', npcId: undefined, sha256: 'a'.repeat(64),
    filename: 'backpack-portrait.png', mime: 'image/png', type: 'image', bytes: 4096,
    source: 'map root',
  };
  const supplemental = { ...primary, source: 'runtime source' };
  assert.deepEqual(deduplicate([primary, supplemental]), [primary]);
});

test('sync rejects duplicate asset sources when their content hashes differ', () => {
  const deduplicate = assetSync.deduplicateIdenticalAssets;
  assert.equal(typeof deduplicate, 'function', 'conflicting source copies must not be chosen silently');

  const primary = {
    key: 'backpack-portrait', npcId: undefined, sha256: 'a'.repeat(64),
    filename: 'backpack-portrait.png', mime: 'image/png', type: 'image', bytes: 4096,
  };
  const conflictingAssets = [
    ['sha256', { sha256: 'b'.repeat(64) }],
    ['filename', { filename: 'backpack-portrait.webp' }],
    ['mime', { mime: 'image/webp' }],
    ['type', { type: 'spritesheet' }],
    ['bytes', { bytes: 4097 }],
  ];

  for (const [field, change] of conflictingAssets) {
    assert.throws(
      () => deduplicate([primary, { ...primary, ...change }]),
      /Duplicate local asset identity/,
      `different ${field} must not be silently ignored`,
    );
  }
});
