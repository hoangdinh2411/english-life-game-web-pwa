import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { planAssetRelease } from './plan-asset-release.mjs';

test('plans immutable storage paths and reports generated map size without uploading', async () => {
  const output = await mkdtemp(join(tmpdir(), 'life-abroad-release-plan-'));
  try {
    const manifest = await planAssetRelease({ releaseId: 'ci-test-1', output, mapIds: ['loc_cafe'] });
    assert.equal(manifest.schemaVersion, 1);
    assert.equal(manifest.releaseId, 'ci-test-1');
    assert.equal(manifest.mapCount, 1);
    assert.equal(manifest.assetCount, manifest.maps[0].assets.length);
    assert.ok(manifest.bytes > 0);
    assert.deepEqual(
      manifest.maps[0].assets.filter(asset => ['animations', 'background', 'player'].includes(asset.key)).map(asset => asset.key).sort(),
      ['animations', 'background', 'player'],
    );
    assert.ok(manifest.maps[0].assets.every(asset => asset.storagePath.startsWith('releases/ci-test-1/loc_cafe/')));
    assert.ok(manifest.maps[0].assets.every(asset => asset.storagePath.includes(asset.sha256)));
    assert.deepEqual(JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8')), manifest);
    assert.match(await readFile(join(output, 'summary.md'), 'utf8'), /Dry run only/);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
