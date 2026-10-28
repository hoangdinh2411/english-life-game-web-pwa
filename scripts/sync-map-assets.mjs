/* global FormData, Blob, AbortSignal */
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const assetRoot = fileURLToPath(new URL('../local-assets/maps/', import.meta.url));
const supportedMaps = new Set(['loc_station', 'loc_town_street', 'loc_cafe', 'loc_corner_cafe', 'loc_clothes', 'loc_tax_office']);

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory() && entry.name !== 'source') files.push(...await filesBelow(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function describeAsset(root, path) {
  const filename = path.split(/[\\/]/).at(-1);
  const extension = extname(filename).toLowerCase();
  const key = filename.slice(0, -extension.length);
  const npcId = key.startsWith('portrait-npc_') ? key.slice('portrait-'.length) : undefined;
  const type = key === 'background' ? 'map'
    : key === 'player' ? 'spritesheet'
    : key === 'animations' ? 'animation'
    : extension === '.mp3' || extension === '.ogg' || extension === '.wav' ? 'audio'
    : extension === '.json' ? 'json' : 'image';
  const mime = extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp'
    : extension === '.svg' ? 'image/svg+xml' : extension === '.mp3' ? 'audio/mpeg'
    : extension === '.ogg' ? 'audio/ogg' : extension === '.wav' ? 'audio/wav' : 'application/json';
  return { path, relativePath: relative(root, path).replaceAll('\\', '/'), filename, key, npcId, type, mime };
}

export function planAssetSync(localAssets, remoteAssets) {
  const remote = new Map(remoteAssets.map(asset => [`${asset.npcId ?? ''}:${asset.key}`, asset]));
  return localAssets.map(asset => {
    const existing = remote.get(`${asset.npcId ?? ''}:${asset.key}`);
    const action = existing?.sha256 === asset.sha256 ? 'skip' : existing ? 'update' : 'upload';
    return { ...asset, action, version: !existing ? 1 : action === 'skip' ? existing.version : existing.version + 1 };
  });
}

export async function syncMapAssets({ mapId, baseUrl, serviceKey, dryRun = false, fetcher = fetch }) {
  if (!supportedMaps.has(mapId)) throw new Error(`Unsupported map: ${mapId}`);
  const directory = join(assetRoot, mapId);
  const localAssets = await Promise.all((await filesBelow(directory)).map(async path => {
    const asset = describeAsset(directory, path);
    const bytes = await readFile(path);
    return { ...asset, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  }));
  const response = await fetcher(`${baseUrl}/content/maps/${mapId}`, { signal: AbortSignal.timeout(15000) });
  const remoteAssets = response.status === 404 ? [] : response.ok ? (await response.json()).assets : (() => { throw new Error(`Asset metadata failed (${response.status})`); })();
  const plan = planAssetSync(localAssets, remoteAssets);
  const changed = plan.filter(asset => asset.action !== 'skip');
  if (!dryRun) for (const asset of changed) {
    const data = await readFile(asset.path);
    const form = new FormData();
    form.set('file', new Blob([data], { type: asset.mime }), asset.filename);
    form.set('mapId', mapId); form.set('type', asset.type); form.set('version', String(asset.version));
    if (asset.npcId) form.set('npcId', asset.npcId);
    const upload = await fetcher(`${baseUrl}/content/assets/upload`, { method: 'POST', headers: { Authorization: `Bearer ${serviceKey}` }, body: form, signal: AbortSignal.timeout(60000) });
    if (!upload.ok) throw new Error(`Upload failed for ${asset.relativePath} (${upload.status}). No remote files were deleted.`);
  }
  return { mapId, dryRun, uploadCount: changed.length, skipCount: plan.length - changed.length,
    assets: plan.map(asset => ({ relativePath: asset.relativePath, key: asset.key, ...(asset.npcId ? { npcId: asset.npcId } : {}),
      type: asset.type, bytes: asset.bytes, sha256: asset.sha256, action: asset.action, version: asset.version })), remoteDeletes: 0 };
}

