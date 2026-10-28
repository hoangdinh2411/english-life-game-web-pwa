import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { basename, extname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { saveMapAssets } from './generate-map-assets.mjs';

export const supportedReleaseMaps = [
  'loc_town_street',
  'loc_cafe',
  'loc_corner_cafe',
  'loc_clothes',
  'loc_tax_office',
];

const requiredFiles = ['animations.json', 'background.png', 'player.png'];
const assetNamePattern = /^[a-z][a-z0-9_-]{0,79}\.(?:json|png|svg|webp)$/;

function parseArguments(arguments_) {
  const options = { mapIds: [], output: 'local-assets/release-plan', releaseId: process.env.ASSET_RELEASE_ID };
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--output') options.output = arguments_[index += 1];
    else if (argument === '--release-id') options.releaseId = arguments_[index += 1];
    else options.mapIds.push(argument);
  }
  if (!options.output || !options.releaseId) throw new Error('--output and ASSET_RELEASE_ID (or --release-id) are required.');
  if (!/^[a-z0-9][a-z0-9._-]{0,79}$/.test(options.releaseId)) throw new Error('Release ID contains unsupported characters.');
  if (options.mapIds.some(mapId => !supportedReleaseMaps.includes(mapId))) {
    throw new Error(`Supported maps: ${supportedReleaseMaps.join(', ')}`);
  }
  return options;
}

function typeFor(filename) {
  if (filename === 'background.png') return 'map';
  if (filename === 'player.png') return 'spritesheet';
  if (filename === 'animations.json') return 'animation';
  return extname(filename) === '.json' ? 'json' : 'image';
}

export async function planAssetRelease({ releaseId, output, mapIds = supportedReleaseMaps }) {
  const outputRoot = resolve(output);
  const generatedRoot = join(outputRoot, 'generated');
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(generatedRoot, { recursive: true });

  const maps = [];
  for (const mapId of mapIds) {
    const directory = await saveMapAssets(mapId, generatedRoot);
    const filenames = (await readdir(directory)).sort();
    const missing = requiredFiles.filter(filename => !filenames.includes(filename));
    if (missing.length) throw new Error(`${mapId} is missing required assets: ${missing.join(', ')}`);
    const invalid = filenames.filter(filename => !assetNamePattern.test(filename));
    if (invalid.length) throw new Error(`${mapId} has invalid asset filenames: ${invalid.join(', ')}`);

    const assets = [];
    for (const filename of filenames) {
      const data = await readFile(join(directory, filename));
      const sha256 = createHash('sha256').update(data).digest('hex');
      assets.push({
        key: basename(filename, extname(filename)),
        type: typeFor(filename),
        bytes: data.byteLength,
        sha256,
        source: relative(outputRoot, join(directory, filename)).replaceAll('\\', '/'),
        storagePath: `releases/${releaseId}/${mapId}/${basename(filename, extname(filename))}/${sha256}${extname(filename)}`,
      });
    }
    maps.push({ mapId, bytes: assets.reduce((total, asset) => total + asset.bytes, 0), assets });
  }

  const manifest = {
    schemaVersion: 1,
    releaseId,
    mapCount: maps.length,
    assetCount: maps.reduce((total, map) => total + map.assets.length, 0),
    bytes: maps.reduce((total, map) => total + map.bytes, 0),
    maps,
  };
  const summary = [
    '# Asset release experiment',
    '',
    `- Release: \`${releaseId}\``,
    `- Maps: ${manifest.mapCount}`,
    `- Assets: ${manifest.assetCount}`,
    `- Total bytes: ${manifest.bytes}`,
    '',
    '| Map | Assets | Bytes |',
    '| --- | ---: | ---: |',
    ...maps.map(map => `| ${map.mapId} | ${map.assets.length} | ${map.bytes} |`),
    '',
    '> Dry run only: no Supabase credentials were loaded and no remote objects were changed.',
    '',
  ].join('\n');
  await writeFile(join(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(join(outputRoot, 'summary.md'), summary);
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const options = parseArguments(process.argv.slice(2).filter(argument => argument !== '--'));
  const manifest = await planAssetRelease({
    releaseId: options.releaseId,
    output: options.output,
    mapIds: options.mapIds.length ? options.mapIds : supportedReleaseMaps,
  });
  console.log(JSON.stringify({ releaseId: manifest.releaseId, maps: manifest.mapCount, assets: manifest.assetCount, bytes: manifest.bytes }, null, 2));
}
