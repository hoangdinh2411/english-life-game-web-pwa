import assert from 'node:assert/strict';
import test from 'node:test';
import { mapAssetSchema } from '../dist/assets.js';

test('remote asset metadata includes the uploaded SHA-256 digest', () => {
  const asset = mapAssetSchema.parse({
    key: 'background',
    type: 'map',
    version: 2,
    url: 'https://example.test/background.png',
    bytes: 128,
    npcId: null,
    sha256: 'a'.repeat(64),
  });

  assert.equal(asset.sha256, 'a'.repeat(64));
  assert.equal(mapAssetSchema.safeParse({ ...asset, sha256: 'not-a-hash' }).success, false);
});
