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
    assert.equal((await readdir(directory)).length, 13);
    assert.deepEqual(await readFile(join(directory, 'background.png')), await readFile(new URL('../apps/game/assets/locations/location_cafe_interior.png', import.meta.url)));
    assert.deepEqual(await readFile(join(directory, 'player.png')), await readFile(new URL('../apps/game/assets/runtime/player.png', import.meta.url)));
    const actors = JSON.parse(await readFile(join(directory, 'actors.json'), 'utf8')).actors;
    assert.equal(actors.length, 3);
    assert.equal(actors.find(actor => actor.npcId === 'npc_mia').texture, 'npc-npc_mia');
    assert.ok((await readdir(directory)).includes('npc-npc_mia.png'));
    assert.equal(JSON.parse(await readFile(join(directory, 'animations.json'), 'utf8')).animations.length, 4);
  } finally {
    await rm(rootDirectory, { recursive: true, force: true });
  }
});

test('Train Station regeneration reads migrated passenger artwork from local-assets', async () => {
  const rootDirectory = await mkdtemp(join(tmpdir(), 'life-abroad-station-assets-test-'));
  try {
    const directory = await generator.saveMapAssets('loc_station', rootDirectory);
    for (const filename of ['backpack.png', 'backpack-atlas.json', 'suitcase.png', 'suitcase-atlas.json', 'visitor.png']) {
      assert.ok((await readdir(directory)).includes(filename));
    }
    assert.deepEqual(
      await readFile(join(directory, 'backpack.png')),
      await readFile(new URL('../local-assets/maps/loc_station/backpack.png', import.meta.url)),
    );
    assert.deepEqual(
      await readFile(join(directory, 'visitor.png')),
      await readFile(new URL('../local-assets/maps/loc_cafe/npc-npc_cafe_customer.png', import.meta.url)),
    );
  } finally {
    await rm(rootDirectory, { recursive: true, force: true });
  }
});

test('Clothes Shop regeneration reads migrated NPC artwork from local-assets', async () => {
  const rootDirectory = await mkdtemp(join(tmpdir(), 'life-abroad-clothes-assets-test-'));
  try {
    const directory = await generator.saveMapAssets('loc_clothes', rootDirectory);
    for (const id of ['npc_clothes_assistant', 'npc_clothes_customer']) {
      assert.deepEqual(
        await readFile(join(directory, `npc-${id}.png`)),
        await readFile(new URL(`../local-assets/maps/loc_clothes/npc-${id}.png`, import.meta.url)),
      );
      assert.deepEqual(
        await readFile(join(directory, `portrait-${id}.png`)),
        await readFile(new URL(`../local-assets/maps/loc_clothes/portrait-${id}.png`, import.meta.url)),
      );
    }
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
    for (const id of ['npc_corner_cup_seller', 'npc_corner_cup_assistant', 'npc_corner_cup_customer_1', 'npc_corner_cup_customer_2', 'npc_corner_cup_customer_3']) {
      assert.deepEqual(
        await readFile(join(directory, `npc-${id}.png`)),
        await readFile(new URL(`../local-assets/maps/loc_corner_cafe/npc-${id}.png`, import.meta.url)),
      );
      assert.deepEqual(
        await readFile(join(directory, `portrait-${id}.png`)),
        await readFile(new URL(`../local-assets/maps/loc_corner_cafe/portrait-${id}.png`, import.meta.url)),
      );
    }
  } finally {
    await rm(rootDirectory, { recursive: true, force: true });
  }
});

// Catches the tax-office pack omitting either staff member, their three portraits, or the approved interior art.
test('Tax Office packages two named staff members and their authored artwork', async () => {
  const rootDirectory = await mkdtemp(join(tmpdir(), 'life-abroad-tax-office-test-'));
  try {
    const directory = await generator.saveMapAssets('loc_tax_office', rootDirectory);
    const actors = JSON.parse(await readFile(join(directory, 'actors.json'), 'utf8')).actors;
    assert.deepEqual(actors.map(actor => actor.npcId), ['npc_tax_clerk_marcus', 'npc_tax_clerk_nadia']);
    assert.deepEqual(actors.map(({ npcId, x, y }) => ({ npcId, x, y })), [
      { npcId: 'npc_tax_clerk_marcus', x: 770, y: 500 },
      { npcId: 'npc_tax_clerk_nadia', x: 920, y: 760 },
    ]);
    assert.deepEqual(await readFile(join(directory, 'background.png')), await readFile(new URL('../apps/game/assets/locations/location_tax_office_interior_labeled.png', import.meta.url)));
    for (const id of ['npc_tax_clerk_marcus', 'npc_tax_clerk_nadia']) {
      const portrait = await readFile(join(directory, `portrait-${id}.png`));
      assert.deepEqual([portrait.readUInt32BE(16), portrait.readUInt32BE(20)], [768, 256]);
      assert.deepEqual(
        await readFile(join(directory, `npc-${id}.png`)),
        await readFile(new URL(`../local-assets/maps/loc_tax_office/npc-${id}.png`, import.meta.url)),
      );
      assert.deepEqual(
        portrait,
        await readFile(new URL(`../local-assets/maps/loc_tax_office/portrait-${id}.png`, import.meta.url)),
      );
    }
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
    assert.equal(actors.length, 15);
    assert.equal(new Set(actors.map(actor => actor.npcId)).size, 15);
    assert.ok(catalog.npcs.every(npc => npc.job && npc.walkImageUrl && npc.topics.length >= 3));
    for (const [index, npc] of catalog.npcs.entries()) {
      const route = catalog.routes.find(route => route.id === npc.routeId);
      assert.ok(route.points.length >= 10 && route.points.length <= 15);
      assert.deepEqual(actors.find(actor => actor.npcId === npc.id), {
        npcId: npc.id, frame: 'walk', ...route.points[npc.startWaypoint], texture: `street-npcs-${index + 1}`, scale: 0.6,
      });
      const source = await readFile(new URL(`../local-assets/maps/loc_town_street/street-npcs-${index + 1}.png`, import.meta.url));
      const image = await readFile(join(directory, `street-npcs-${index + 1}.png`));
      const atlas = JSON.parse(await readFile(join(directory, `street-npcs-${index + 1}-atlas.json`), 'utf8'));
      const portrait = await readFile(join(directory, `portrait-${npc.id}.png`));
      assert.deepEqual(image, source);
      assert.deepEqual([image.readUInt32BE(16), image.readUInt32BE(20)], [512, 768]);
      assert.equal(Object.keys(atlas.frames).length, 17);
      assert.deepEqual(portrait, await readFile(new URL(`../local-assets/maps/loc_town_street/portrait-${npc.id}.png`, import.meta.url)));
      assert.ok(Object.keys(atlas.frames).every(name => name === 'walk' || name.startsWith('walk-')));
      assert.deepEqual(atlas.frames['walk-0-3'].frame, { x: 384, y: 0, w: 128, h: 192 });
      assert.deepEqual(atlas.frames['walk-2-1'].frame, { x: 128, y: 384, w: 128, h: 192 });
      assert.ok(Object.values(atlas.frames).every(({ frame: item }) => item.y < image.readUInt32BE(20)), `${npc.id} atlas coordinates fit the image`);
    }
  } finally {
    await rm(rootDirectory, { recursive: true, force: true });
  }
});
