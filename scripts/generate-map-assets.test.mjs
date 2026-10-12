import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import * as generator from './generate-map-assets.mjs';

test('saveMapAssets packages existing artwork without replacing it with SVG placeholders', async () => {
  const rootDirectory = await mkdtemp(join(tmpdir(), 'life-abroad-assets-test-'));
  try {
    assert.equal(typeof generator.saveMapAssets, 'function');
    const directory = await generator.saveMapAssets('loc_cafe', rootDirectory);
    assert.equal(directory, join(rootDirectory, 'loc_cafe'));
    assert.deepEqual((await readdir(directory)).sort(), ['actors.json', 'animations.json', 'background.png', 'player.png', 'shop-npcs-atlas.json', 'shop-npcs.png']);
    assert.deepEqual(await readFile(join(directory, 'background.png')), await readFile(new URL('../apps/game/assets/locations/location_cafe_interior.png', import.meta.url)));
    assert.deepEqual(await readFile(join(directory, 'player.png')), await readFile(new URL('../apps/game/assets/runtime/player.png', import.meta.url)));
    assert.deepEqual(await readFile(join(directory, 'shop-npcs.png')), await readFile(new URL('../apps/game/assets/npcs/shop-walk.png', import.meta.url)));
    assert.equal(JSON.parse(await readFile(join(directory, 'actors.json'), 'utf8')).actors.length, 3);
    assert.equal(JSON.parse(await readFile(join(directory, 'animations.json'), 'utf8')).animations.length, 4);
  } finally {
    await rm(rootDirectory, { recursive: true, force: true });
  }
});

test('Corner Cup map reuses café art and packages three additional customers', async () => {
  const rootDirectory = await mkdtemp(join(tmpdir(), 'life-abroad-corner-cafe-test-'));
  try {
    const directory = await generator.saveMapAssets('loc_corner_cafe', rootDirectory);
    const actors = JSON.parse(await readFile(join(directory, 'actors.json'), 'utf8')).actors;
    assert.equal(actors.length, 5);
    assert.equal(actors.filter(actor => actor.npcId?.includes('customer')).length, 3);
    assert.equal(actors[0].npcId, 'npc_corner_cup_seller');
  } finally {
    await rm(rootDirectory, { recursive: true, force: true });
  }
});
