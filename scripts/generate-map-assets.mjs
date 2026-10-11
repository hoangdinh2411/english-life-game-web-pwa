/* global FormData, Blob, AbortSignal */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const localAssetRoot = fileURLToPath(new URL('../local-assets/maps/', import.meta.url));

// Package authored artwork byte-for-byte. Never substitute generated placeholders.
async function mapAssets(mapId) {
  const backgrounds = {
    loc_town_street: 'location_maplewood_street.png',
    loc_cafe: 'location_cafe_interior.png',
    loc_clothes: 'location_clothes_interior.png',
  };
  if (!Object.hasOwn(backgrounds, mapId)) throw new Error('Unsupported destination map');
  const source = (path) => readFile(new URL(`../apps/game/assets/${path}`, import.meta.url));
  const assets = [
    { name: 'background.png', type: 'map', mime: 'image/png', data: await source(`locations/${backgrounds[mapId]}`) },
    { name: 'player.png', type: 'spritesheet', mime: 'image/png', data: await source('runtime/player.png') },
    { name: 'animations.json', type: 'animation', mime: 'application/json', data: JSON.stringify({ animations: Array.from({ length: 4 }, (_, row) => ({ key: `walk-${row}`, texture: 'player', frames: Array.from({ length: 4 }, (_, column) => row * 4 + column), frameRate: 7, repeat: -1 })) }) },
  ];
  if (mapId !== 'loc_town_street') {
    const cafe = mapId === 'loc_cafe';
    const actors = cafe ? [
      { frame: 'cafe_seller', x: 800, y: 275 },
      { frame: 'cafe_waiter', x: 1000, y: 460 },
      { frame: 'cafe_customer', x: 400, y: 600 },
    ] : [
      { frame: 'clothes_seller', x: 1190, y: 270 },
      { frame: 'clothes_assistant', x: 550, y: 500 },
      { frame: 'clothes_customer', x: 970, y: 690 },
    ];
    assets.push(
      { name: 'shop-npcs.png', type: 'image', mime: 'image/png', data: await source('npcs/shop-npcs.png') },
      { name: 'shop-npcs-atlas.json', type: 'json', mime: 'application/json', data: await source('npcs/shop-npcs.json') },
      { name: 'actors.json', type: 'json', mime: 'application/json', data: JSON.stringify({ actors: actors.map(actor => ({ ...actor, texture: 'shop-npcs', scale: 0.22 })) }) },
    );
  }
  return assets;
}

export async function saveMapAssets(mapId, outputRoot = localAssetRoot) {
  const assets = await mapAssets(mapId);
  const directory = join(outputRoot, mapId);
  await mkdir(directory, { recursive: true });
  for (const asset of assets) await writeFile(join(directory, asset.name), asset.data, 'utf8');
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
    const response = await fetcher(`${baseUrl}/content/assets/upload`, { method: 'POST', headers: { Authorization: `Bearer ${serviceKey}` }, body: form, signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`Upload failed (${response.status}); generated file retained at ${path}`);
    const result = await response.json();
    if (typeof result.url !== 'string' || typeof result.bytes !== 'number') throw new Error(`Invalid upload response; generated file retained at ${path}`);
    results.push(result);
  }
  return results;
}
