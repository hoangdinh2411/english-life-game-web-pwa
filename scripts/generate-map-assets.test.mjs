import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import * as generator from './generate-map-assets.mjs';

test('saveMapAssets writes the generated pack to a reusable local folder without Storage', async () => {
  const rootDirectory = await mkdtemp(join(tmpdir(), 'life-abroad-assets-test-'));
  try {
    assert.equal(typeof generator.saveMapAssets, 'function');
    const directory = await generator.saveMapAssets('loc_cafe', rootDirectory);
    assert.equal(directory, join(rootDirectory, 'loc_cafe'));
    assert.deepEqual((await readdir(directory)).sort(), ['animations.json', 'background.svg', 'player.svg']);
    assert.match(await readFile(join(directory, 'background.svg'), 'utf8'), /Maple Cafe/);
    assert.equal(JSON.parse(await readFile(join(directory, 'animations.json'), 'utf8')).animations.length, 4);
  } finally {
    await rm(rootDirectory, { recursive: true, force: true });
  }
});
