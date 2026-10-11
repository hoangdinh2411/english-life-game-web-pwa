import { saveMapAssets } from './generate-map-assets.mjs';

const supportedMaps = ['loc_town_street', 'loc_cafe', 'loc_clothes'];
const mapIds = process.argv.slice(2);
if (mapIds.some((mapId) => !supportedMaps.includes(mapId))) {
  throw new Error(`Supported maps: ${supportedMaps.join(', ')}`);
}

const selectedMaps = mapIds.length ? mapIds : supportedMaps;
const saved = await Promise.all(selectedMaps.map(async (mapId) => ({
  mapId,
  directory: await saveMapAssets(mapId),
})));
console.log(JSON.stringify(saved, null, 2));
