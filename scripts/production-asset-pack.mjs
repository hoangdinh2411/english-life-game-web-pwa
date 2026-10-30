import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { collectLocalMapAssets, defaultAssetRoot, supportedMaps } from './sync-map-assets.mjs';

export async function createAssetManifest(root = defaultAssetRoot) {
  const maps = {};
  for (const mapId of supportedMaps) {
    maps[mapId] = (await collectLocalMapAssets(mapId, root)).map(asset => ({
      logicalKey: `${asset.npcId ?? 'map'}:${asset.key}`,
      sourcePath: relative(root, asset.path).replaceAll('\\', '/'),
      bytes: asset.bytes,
      sha256: asset.sha256,
    })).sort((left, right) => left.logicalKey.localeCompare(right.logicalKey));
  }
  return { schemaVersion: 1, maps };
}

export async function validateAssetManifest(root, manifest) {
  if (manifest?.schemaVersion !== 1 || !manifest.maps || typeof manifest.maps !== 'object') throw new Error('Malformed production asset manifest.');
  const actual = await createAssetManifest(root);
  const expectedMapIds = Object.keys(actual.maps);
  if (JSON.stringify(Object.keys(manifest.maps).sort()) !== JSON.stringify([...expectedMapIds].sort())) {
    throw new Error(`Manifest must contain exactly: ${expectedMapIds.join(', ')}.`);
  }
  for (const mapId of expectedMapIds) {
    const expected = manifest.maps[mapId];
    if (!Array.isArray(expected)) throw new Error(`Manifest map ${mapId} must be an array.`);
    const keys = new Set();
    for (const entry of expected) {
      if (!entry || typeof entry.logicalKey !== 'string' || typeof entry.sourcePath !== 'string'
        || !Number.isInteger(entry.bytes) || !/^[a-f0-9]{64}$/.test(entry.sha256 ?? '')) throw new Error(`Malformed manifest entry for ${mapId}.`);
      if (keys.has(entry.logicalKey)) throw new Error(`Duplicate manifest key for ${mapId}: ${entry.logicalKey}`);
      keys.add(entry.logicalKey);
    }
    if (JSON.stringify(expected) !== JSON.stringify(actual.maps[mapId])) throw new Error(`Asset pack does not match the reviewed manifest for ${mapId}.`);
  }
  return actual;
}

async function runTar(output) {
  await mkdir(dirname(output), { recursive: true });
  await new Promise((resolvePromise, reject) => {
    const child = spawn('tar', ['-czf', output, '-C', dirname(defaultAssetRoot), 'maps'], { stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolvePromise() : reject(new Error(`tar exited with code ${code}`)));
  });
}

const isMain = resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url);
const [command, first, second] = process.argv.slice(2).filter(argument => argument !== '--');
if (isMain && command === 'create') {
  if (!first || !second) throw new Error('Usage: production-asset-pack create <archive.tgz> <manifest.json>');
  const archive = resolve(first); const manifestPath = resolve(second);
  const manifest = await createAssetManifest();
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  await runTar(archive);
  const archiveHash = createHash('sha256').update(await readFile(archive)).digest('hex');
  const manifestHash = createHash('sha256').update(await readFile(manifestPath)).digest('hex');
  console.log(JSON.stringify({ archive, archiveSha256: archiveHash, manifest: manifestPath, manifestSha256: manifestHash }));
} else if (isMain && command === 'validate') {
  if (!first || !second) throw new Error('Usage: production-asset-pack validate <maps-directory> <manifest.json>');
  const manifest = JSON.parse(await readFile(resolve(second), 'utf8'));
  await validateAssetManifest(resolve(first), manifest);
  console.log(JSON.stringify({ valid: true, maps: supportedMaps }));
} else if (isMain) {
  throw new Error('Usage: production-asset-pack <create|validate> ...');
}

