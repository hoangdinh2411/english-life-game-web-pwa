/* global FormData, Blob, AbortSignal */
import { mkdtemp, writeFile, readFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Procedural experiment artwork. Generated files exist only in a temporary directory.
export function generateMap(mapId) {
  if (!['loc_town_street', 'loc_cafe', 'loc_clothes'].includes(mapId)) throw new Error('Unsupported destination map');
  const street = mapId === 'loc_town_street';
  const buildings = Array.from({ length: 6 }, (_, index) => {
    const x = 90 + index * 240;
    return `<rect x="${x}" y="300" width="170" height="220" rx="12" fill="${index % 2 ? '#e0b680' : '#9fbbb0'}"/><rect x="${x + 60}" y="420" width="50" height="100" fill="#46635b"/><rect x="${x + 20}" y="340" width="45" height="50" fill="#e8f4e9"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024"><rect width="1536" height="1024" fill="${street ? '#c3d5b5' : '#e8d5b6'}"/><rect x="48" y="110" width="1440" height="875" rx="30" fill="${street ? '#e2d5bf' : '#f1e5ce'}"/>${buildings}<path d="M48 690H1488" stroke="#b5ad99" stroke-width="190"/><text x="768" y="260" text-anchor="middle" font-family="sans-serif" font-size="48" fill="#263630">${street ? 'Maplewood Town Street' : mapId === 'loc_cafe' ? 'Maple Cafe' : 'Clothes Shop'}</text><circle cx="768" cy="${street ? 130 : 930}" r="34" fill="#73dfa0"/></svg>`;
}
export function generatePlayer() {
  const frames = Array.from({ length: 16 }, (_, index) => {
    const x = (index % 4) * 32, y = Math.floor(index / 4) * 48, stride = index % 2 ? 2 : -2;
    return `<g transform="translate(${x},${y})"><circle cx="16" cy="10" r="7" fill="#deb48a"/><rect x="9" y="18" width="14" height="18" rx="4" fill="#426f61"/><rect x="10" y="34" width="5" height="${10 + stride}" fill="#33485e"/><rect x="18" y="34" width="5" height="${10 - stride}" fill="#33485e"/></g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="192">${frames}</svg>`;
}
export async function generateAndUpload({ mapId = 'loc_town_street', version = 1, baseUrl, serviceKey, fetcher = fetch }) {
  if (!serviceKey || !baseUrl) throw new Error('CONTENT_API_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  if (!Number.isSafeInteger(version) || version < 1 || version > 2147483647) throw new Error('Version must be a positive 32-bit integer');
  const assets = [
    { name: 'background.svg', type: 'map', mime: 'image/svg+xml', data: generateMap(mapId) },
    { name: 'player.svg', type: 'spritesheet', mime: 'image/svg+xml', data: generatePlayer() },
    { name: 'animations.json', type: 'animation', mime: 'application/json', data: JSON.stringify({ animations: Array.from({ length: 4 }, (_, row) => ({ key: `walk-${row}`, texture: 'player', frames: Array.from({ length: 4 }, (_, column) => row * 4 + column), frameRate: 7, repeat: -1 })) }) },
  ];
  const directory = await mkdtemp(join(tmpdir(), 'life-abroad-assets-'));
  const results = [];
  for (const asset of assets) {
    const path = join(directory, asset.name);
    await writeFile(path, asset.data, { flag: 'wx' });
    const file = await readFile(path);
    const form = new FormData();
    form.set('file', new Blob([file], { type: asset.mime }), asset.name);
    form.set('mapId', mapId); form.set('type', asset.type); form.set('version', String(version));
    const response = await fetcher(`${baseUrl}/content/assets/upload`, { method: 'POST', headers: { Authorization: `Bearer ${serviceKey}` }, body: form, signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`Upload failed (${response.status}); generated file retained at ${path}`);
    const result = await response.json();
    if (typeof result.url !== 'string' || typeof result.bytes !== 'number') throw new Error(`Invalid upload response; generated file retained at ${path}`);
    await unlink(path); // Delete only after confirmed upload; never delete a supplied source file.
    results.push(result);
  }
  await rmdir(directory);
  return results;
}
