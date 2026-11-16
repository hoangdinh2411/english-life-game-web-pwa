import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import * as assetSync from './sync-map-assets.mjs';

const { assertUniqueAssetIdentities, planAssetSync, supportedMaps, syncMapAssets } = assetSync;

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

test('sync supports loc_airport_departure and loc_airport_arrival map packs and rejects unsupported maps', async () => {
  assert.ok(supportedMaps.has('loc_airport_departure'));
  assert.ok(supportedMaps.has('loc_airport_arrival'));
  await assert.rejects(
    () => syncMapAssets({ mapId: 'loc_unknown_airport', baseUrl: 'http://127.0.0.1:3000/api/v1', dryRun: true }),
    /Unsupported map: loc_unknown_airport/,
  );

  const rootDirectory = await mkdtemp(join(tmpdir(), 'life-abroad-sync-airport-test-'));
  try {
    for (const mapId of ['loc_airport_departure', 'loc_airport_arrival']) {
      const mapDir = join(rootDirectory, mapId);
      await mkdir(mapDir, { recursive: true });
      await writeFile(join(mapDir, 'background.png'), 'bg-bytes');
      await writeFile(join(mapDir, 'player.png'), 'player-bytes');
      await writeFile(join(mapDir, 'animations.json'), '{"animations":[]}');
      await writeFile(join(mapDir, 'actors.json'), '{"actors":[]}');
      if (mapId === 'loc_airport_departure') {
        await writeFile(join(mapDir, 'portrait-npc_airport_agent.png'), 'portrait-bytes');
      }

      const result = await syncMapAssets({
        mapId,
        baseUrl: 'http://127.0.0.1:3000/api/v1',
        dryRun: true,
        rootDirectory,
        fetcher: async () => ({ status: 404, ok: false }),
      });

      assert.equal(result.mapId, mapId);
      assert.equal(result.dryRun, true);
      assert.equal(result.skipCount, 0);
      assert.equal(result.uploadCount, mapId === 'loc_airport_departure' ? 5 : 4);
      if (mapId === 'loc_airport_departure') {
        assert.equal(result.assets.find(asset => asset.key === 'portrait-npc_airport_agent')?.npcId, 'npc_airport_agent');
      }
    }
  } finally {
    await rm(rootDirectory, { recursive: true, force: true });
  }
});
