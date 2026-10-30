/* global FormData, Blob, AbortSignal */
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const defaultAssetRoot = fileURLToPath(new URL('../local-assets/maps/', import.meta.url));
export const supportedMaps = Object.freeze(['loc_station', 'loc_town_street', 'loc_cafe', 'loc_corner_cafe', 'loc_clothes', 'loc_tax_office']);
const supportedMapSet = new Set(supportedMaps);
const supplementalAssets = new Map([
  ['loc_station', [
    { path: 'source/runtime/backpack-portrait.png' },
    { path: 'source/runtime/suitcase-portrait.png' },
    { path: '../loc_cafe/portrait-npc_cafe_customer.png', filename: 'visitor-portrait.png' },
  ]],
]);

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

async function validateRuntimeContract(directory, files) {
  const names = new Set(files.map(path => relative(directory, path).replaceAll('\\', '/')));
  for (const required of ['background.png', 'player.png', 'animations.json']) {
    if (!names.has(required)) throw new Error(`Missing required asset: ${required}`);
  }
  let animationFile;
  try { animationFile = JSON.parse(await readFile(join(directory, 'animations.json'), 'utf8')); }
  catch { throw new Error('Malformed asset: animations.json must contain valid JSON.'); }
  const animations = Array.isArray(animationFile?.animations) ? animationFile.animations : [];
  for (const key of ['walk-0', 'walk-1', 'walk-2', 'walk-3']) {
    const animation = animations.find(entry => entry?.key === key);
    if (animation?.texture !== 'player' || !Array.isArray(animation.frames) || animation.frames.length === 0
      || !animation.frames.every(Number.isInteger) || !Number.isFinite(animation.frameRate) || !Number.isInteger(animation.repeat)) {
      throw new Error(`Malformed asset: animations.json has an invalid ${key} contract.`);
    }
  }
}

function describeAsset(root, path, filenameOverride) {
  const filename = filenameOverride ?? path.split(/[\\/]/).at(-1);
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

export function assertUniqueAssetIdentities(assets) {
  const identities = new Set();
  for (const asset of assets) {
    const identity = `${asset.npcId ?? ''}:${asset.key}`;
    if (identities.has(identity)) throw new Error(`Duplicate local asset identity: ${identity}`);
    identities.add(identity);
  }
}


export async function collectLocalMapAssets(mapId, root = defaultAssetRoot) {
  if (!supportedMapSet.has(mapId)) throw new Error(`Unsupported map: ${mapId}`);
  const directory = join(root, mapId);
  const files = await filesBelow(directory);
  await validateRuntimeContract(directory, files);
  const sources = [
    ...files.map(path => ({ path })),
    ...(supplementalAssets.get(mapId) ?? []).map(asset => ({ ...asset, path: join(directory, asset.path) })),
  ];
  const localAssets = await Promise.all(sources.map(async source => {
    const asset = describeAsset(directory, source.path, source.filename);
    const data = await readFile(source.path);
    return { ...asset, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') };
  }));
  assertUniqueAssetIdentities(localAssets);
  return localAssets;
}

export async function executeAssetPlan(plan, upload) {
  const failures = [];
  for (const asset of plan.filter(entry => entry.action !== 'skip')) {
    try { await upload(asset); }
    catch (error) { failures.push({ key: `${asset.npcId ?? 'map'}:${asset.key}`, error: error instanceof Error ? error.message : String(error) }); }
  }
  if (failures.length) throw new AggregateError(failures.map(failure => new Error(`${failure.key}: ${failure.error}`)),
    `Asset reconciliation failed for ${failures.map(failure => failure.key).join(', ')}. Successful immutable uploads were retained.`);
}

export async function syncMapAssets({ mapId, baseUrl, serviceKey, dryRun = false, fetcher = fetch, assetRoot = defaultAssetRoot }) {
  const localAssets = await collectLocalMapAssets(mapId, assetRoot);
  const response = await fetcher(`${baseUrl}/content/maps/${mapId}`, { signal: AbortSignal.timeout(15000) });
  const remoteAssets = response.status === 404 ? [] : response.ok ? (await response.json()).assets : (() => { throw new Error(`Asset metadata failed (${response.status})`); })();
  const plan = planAssetSync(localAssets, remoteAssets);
  const changed = plan.filter(asset => asset.action !== 'skip');
  if (!dryRun) await executeAssetPlan(changed, async asset => {
    const data = await readFile(asset.path);
    const form = new FormData();
    form.set('file', new Blob([data], { type: asset.mime }), asset.filename);
    form.set('mapId', mapId); form.set('type', asset.type); form.set('version', String(asset.version));
    if (asset.npcId) form.set('npcId', asset.npcId);
    const upload = await fetcher(`${baseUrl}/content/assets/upload`, { method: 'POST', headers: { Authorization: `Bearer ${serviceKey}` }, body: form, signal: AbortSignal.timeout(60000) });
    if (!upload.ok) throw new Error(`Upload failed for ${asset.relativePath} (${upload.status}). No remote files were deleted.`);
  });
  return { mapId, dryRun, uploadCount: changed.length, skipCount: plan.length - changed.length,
    assets: plan.map(asset => ({ relativePath: asset.relativePath, key: asset.key, ...(asset.npcId ? { npcId: asset.npcId } : {}),
      type: asset.type, bytes: asset.bytes, sha256: asset.sha256, action: asset.action, version: asset.version })), remoteDeletes: 0 };
}

