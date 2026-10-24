/* global FormData, Blob, AbortSignal */
import { Buffer } from 'node:buffer';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const localAssetRoot = fileURLToPath(new URL('../local-assets/maps/', import.meta.url));
const streetNpcDataUrl = new URL('../content/seed/street-npcs.json', import.meta.url);
const npcDataUrl = new URL('../content/seed/npcs.json', import.meta.url);
const bundledServiceNpcIds = new Set([
  'npc_mia', 'npc_cafe_waiter',
  'npc_corner_cup_seller', 'npc_corner_cup_assistant',
  'npc_clothes_seller', 'npc_clothes_assistant',
]);

function npcWalkAtlas(outputName) {
  const frame = (column, row) => ({ frame: { x: column * 128, y: row * 192, w: 128, h: 192 }, rotated: false, trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w: 128, h: 192 }, sourceSize: { w: 128, h: 192 } });
  const frames = { walk: frame(0, 0) };
  // Each source row is one direction; its four columns are the walk cycle.
  for (let direction = 0; direction < 4; direction++) {
    for (let step = 0; step < 4; step++) frames[`walk-${direction}-${step}`] = frame(step, direction);
  }
  return Buffer.from(JSON.stringify({ frames, meta: { image: outputName, size: { w: 512, h: 768 }, scale: '1' } }));
}

async function npcAsset(reference) {
  if (/^https:\/\//.test(reference)) {
    const response = await fetch(reference, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`NPC image could not be read (${response.status})`);
    return Buffer.from(await response.arrayBuffer());
  }
  if (!/^npcs\/[a-z0-9_]+\/(?:walk|portraits)\.png$/.test(reference)) throw new Error('NPC artwork must use a per-NPC asset path or HTTPS URL');
  return readFile(new URL(`../apps/game/assets/${reference}`, import.meta.url));
}

// Package authored artwork byte-for-byte. Never substitute generated placeholders.
async function mapAssets(mapId) {
  const backgrounds = {
    loc_town_street: 'location_maplewood_street_expanded.png',
    loc_cafe: 'location_cafe_interior.png',
    loc_corner_cafe: 'location_cafe_interior.png',
    loc_clothes: 'location_clothes_interior.png',
  };
  if (!Object.hasOwn(backgrounds, mapId)) throw new Error('Unsupported destination map');
  const source = (path) => readFile(new URL(`../apps/game/assets/${path}`, import.meta.url));
  const assets = [
    { name: 'background.png', type: 'map', mime: 'image/png', data: await source(`locations/${backgrounds[mapId]}`) },
    { name: 'player.png', type: 'spritesheet', mime: 'image/png', data: await source('runtime/player.png') },
    { name: 'animations.json', type: 'animation', mime: 'application/json', data: JSON.stringify({ animations: Array.from({ length: 4 }, (_, row) => ({ key: `walk-${row}`, texture: 'player', frames: Array.from({ length: 4 }, (_, column) => row * 4 + column), frameRate: 7, repeat: -1 })) }) },
  ];
  if (mapId === 'loc_town_street') {
    const catalog = JSON.parse(await readFile(streetNpcDataUrl, 'utf8'));
    const textureByNpc = new Map();
    for (const [index, npc] of catalog.npcs.entries()) {
      const key = `street-npcs-${index + 1}`;
      const filename = `${key}.png`;
      assets.push(
        { name: filename, type: 'image', mime: 'image/png', data: await npcAsset(npc.walkImageUrl) },
        { name: `${key}-atlas.json`, type: 'json', mime: 'application/json', data: npcWalkAtlas(filename) },
        { name: `portrait-${npc.id}.png`, type: 'image', mime: 'image/png', npcId: npc.id, data: await npcAsset(npc.portrait.imageUrl) },
      );
      textureByNpc.set(npc.id, key);
    }
    const routes = new Map(catalog.routes.map(route => [route.id, route]));
    const actors = catalog.npcs.map(npc => {
      const route = routes.get(npc.routeId);
      const point = route?.points[npc.startWaypoint];
      if (!point) throw new Error(`${npc.id} has no valid start point`);
      return { npcId: npc.id, frame: npc.frame, x: point.x, y: point.y, texture: textureByNpc.get(npc.id), scale: 0.6 };
    });
    assets.push({ name: 'actors.json', type: 'json', mime: 'application/json', data: JSON.stringify({ actors }) });
  } else {
    const actors = mapId === 'loc_corner_cafe' ? [
      { npcId: 'npc_corner_cup_seller', x: 800, y: 390 },
      { npcId: 'npc_corner_cup_assistant', x: 1000, y: 460 },
      { npcId: 'npc_corner_cup_customer_1', x: 430, y: 600 },
      { npcId: 'npc_corner_cup_customer_2', x: 1080, y: 600 },
      { npcId: 'npc_corner_cup_customer_3', x: 430, y: 750 },
    ] : mapId === 'loc_cafe' ? [
      { npcId: 'npc_mia', x: 800, y: 390 },
      { npcId: 'npc_cafe_waiter', x: 1000, y: 460 },
      { npcId: 'npc_cafe_customer', x: 430, y: 600 },
    ] : [
      { npcId: 'npc_clothes_seller', x: 1005, y: 405 },
      { npcId: 'npc_clothes_assistant', x: 550, y: 500 },
      { npcId: 'npc_clothes_customer', x: 970, y: 690 },
    ];
    const catalog = JSON.parse(await readFile(npcDataUrl, 'utf8'));
    const byId = new Map(catalog.map(npc => [npc.id, npc]));
    const actorData = [];
    for (const actor of actors) {
      const npc = byId.get(actor.npcId);
      if (!npc?.walkImageUrl) throw new Error(`${actor.npcId} is missing its walking asset`);
      if (bundledServiceNpcIds.has(actor.npcId)) {
        actorData.push({ ...actor, frame: 'walk', texture: `service-${actor.npcId}`, scale: 0.6 });
        continue;
      }
      const key = `npc-${actor.npcId}`;
      const filename = `${key}.png`;
      assets.push(
        { name: filename, type: 'image', mime: 'image/png', data: await source(npc.walkImageUrl) },
        { name: `${key}-atlas.json`, type: 'json', mime: 'application/json', data: npcWalkAtlas(filename) },
        { name: `portrait-${npc.id}.png`, type: 'image', mime: 'image/png', npcId: npc.id, data: await source(npc.portrait.imageUrl) },
      );
      actorData.push({ ...actor, frame: 'walk', texture: key, scale: 0.6 });
    }
    assets.push({ name: 'actors.json', type: 'json', mime: 'application/json', data: JSON.stringify({ actors: actorData }) });
  }
  return assets;
}

export async function saveMapAssets(mapId, outputRoot = localAssetRoot) {
  const assets = await mapAssets(mapId);
  const directory = join(outputRoot, mapId);
  await mkdir(directory, { recursive: true });
  for (const asset of assets) await writeFile(join(directory, asset.name), asset.data);
  return directory;
}

export async function generateAndUpload({ mapId = 'loc_town_street', version = 1, baseUrl, serviceKey, fetcher = fetch }) {
  if (!serviceKey || !baseUrl) throw new Error('CONTENT_API_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  if (!Number.isSafeInteger(version) || version < 1 || version > 2147483647) throw new Error('Version must be a positive 32-bit integer');
  const assets = await mapAssets(mapId);
  const directory = await saveMapAssets(mapId);
  const results = [];
  for (const asset of assets) {
    const path = join(directory, asset.name);
    const file = await readFile(path);
    const form = new FormData();
    form.set('file', new Blob([file], { type: asset.mime }), asset.name);
    form.set('mapId', mapId); form.set('type', asset.type); form.set('version', String(version));
    if (asset.npcId) form.set('npcId', asset.npcId);
    const response = await fetcher(`${baseUrl}/content/assets/upload`, { method: 'POST', headers: { Authorization: `Bearer ${serviceKey}` }, body: form, signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`Upload failed (${response.status}); generated file retained at ${path}`);
    const result = await response.json();
    if (typeof result.url !== 'string' || typeof result.bytes !== 'number') throw new Error(`Invalid upload response; generated file retained at ${path}`);
    results.push(result);
  }
  return results;
}
