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

test('Town Street map packages all data-authored residents at their route start points', async () => {
  const rootDirectory = await mkdtemp(join(tmpdir(), 'life-abroad-street-npcs-test-'));
  try {
    const directory = await generator.saveMapAssets('loc_town_street', rootDirectory);
    const catalog = JSON.parse(await readFile(new URL('../content/seed/street-npcs.json', import.meta.url), 'utf8'));
    const actors = JSON.parse(await readFile(join(directory, 'actors.json'), 'utf8')).actors;
    const frames = [...new Set(catalog.npcs.map(npc => npc.frame))];
    const textureByFrame = new Map(frames.map((frame, index) => [frame, `street-npcs-${index + 1}`]));
    assert.equal(actors.length, 15);
    assert.equal(new Set(actors.map(actor => actor.npcId)).size, 15);
    assert.ok(catalog.npcs.every(npc => npc.job && npc.imageUrl && npc.topics.length >= 3));
    for (const npc of catalog.npcs) {
      const route = catalog.routes.find(route => route.id === npc.routeId);
      assert.ok(route.points.length >= 10 && route.points.length <= 15);
      assert.deepEqual(actors.find(actor => actor.npcId === npc.id), {
        npcId: npc.id, frame: npc.frame, ...route.points[npc.startWaypoint], texture: textureByFrame.get(npc.frame), scale: 0.6,
      });
    }
    const source = await readFile(new URL('../apps/game/assets/npcs/shop-walk.png', import.meta.url));
    assert.equal(frames.length, 6);
    for (const [index, frame] of frames.entries()) {
      const image = await readFile(join(directory, `street-npcs-${index + 1}.png`));
      const atlas = JSON.parse(await readFile(join(directory, `street-npcs-${index + 1}-atlas.json`), 'utf8'));
      assert.equal(image.toString('ascii', 1, 4), 'PNG');
      assert.equal(image.readUInt32BE(16), 1536);
      assert.ok(image.readUInt32BE(20) < 1024, `${frame} should download as a cropped atlas row`);
      assert.ok(image.byteLength < source.byteLength, `${frame} should be smaller than the full resident atlas`);
      assert.ok(Object.keys(atlas.frames).length >= 17);
      assert.ok(Object.keys(atlas.frames).every(name => name === frame || name.startsWith(`${frame}-`)));
      assert.ok(Object.values(atlas.frames).every(({ frame: item }) => item.y < image.readUInt32BE(20)), `${frame} atlas coordinates fit the cropped image`);
    }
  } finally {
    await rm(rootDirectory, { recursive: true, force: true });
  }
});
