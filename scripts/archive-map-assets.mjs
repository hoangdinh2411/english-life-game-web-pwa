import { cp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const sourceRoot = join(repositoryRoot, 'apps/game/assets');
const outputRoot = join(repositoryRoot, 'local-assets/maps');

const filesByMap = {
  loc_station: [
    'locations/location_station_map_labeled.png',
    'characters/character_newcomer_source.png',
    'characters/character_newcomer_transparent.png',
    'npcs/npc_passenger_backpack_source.png',
    'npcs/npc_passenger_backpack_transparent.png',
    'npcs/npc_passenger_suitcase_source.png',
    'npcs/npc_station_information_source.png',
    'npcs/npc_station_information_transparent.png',
    'runtime/backpack-portrait.png',
    'runtime/backpack.json',
    'runtime/backpack.png',
    'runtime/extraction.json',
    'runtime/player-portrait.png',
    'runtime/player.json',
    'runtime/player.png',
    'runtime/portrait-extraction.json',
    'runtime/receptionist-portrait.png',
    'runtime/receptionist.json',
    'runtime/receptionist.png',
    'runtime/suitcase-portrait.png',
    'runtime/suitcase.json',
    'runtime/suitcase.png',
  ],
  loc_cafe: ['locations/location_cafe_interior.png'],
  loc_corner_cafe: ['locations/location_cafe_interior.png'],
  loc_clothes: ['locations/location_clothes_interior.png'],
  loc_town_street: ['locations/location_maplewood_street.png'],
  loc_tax_office: [
    'locations/location_tax_office_exterior_labeled.png',
    'locations/location_tax_office_interior_labeled.png',
    'npcs/npc_tax_clerk_source.png',
    'ui/ui_id_card_source.png',
  ],
};

const results = [];
for (const [mapId, files] of Object.entries(filesByMap)) {
  const destination = join(outputRoot, mapId, 'source');
  for (const relativePath of files) {
    const source = join(sourceRoot, relativePath);
    const target = join(destination, relativePath);
    await stat(source);
    await mkdir(dirname(target), { recursive: true });
    await cp(source, target, { force: true });
  }
  results.push({ mapId, fileCount: files.length, directory: destination });
}

const stationSource = join(outputRoot, 'loc_station', 'source');
const stationAudioRoot = join(sourceRoot, 'audio/station');
const stationManifest = JSON.parse(await readFile(join(stationAudioRoot, 'manifest.json'), 'utf8'));
const stationNpcIds = ['npc_station_information', 'npc_passenger_backpack', 'npc_passenger_suitcase'];
const audioManifestByNpc = new Map(stationNpcIds.map((npcId) => [npcId, []]));
const unassignedAudio = [];
const legacyOwnersByLine = {
  'line-02': ['npc_station_information'],
  'line-03': ['npc_station_information'],
  'line-04': ['npc_station_information'],
  'line-05': ['npc_station_information'],
  'line-06': ['npc_station_information'],
  'line-07': ['npc_station_information'],
  'line-08': ['npc_passenger_backpack'],
  'line-09': ['npc_passenger_backpack'],
  'line-10': ['npc_passenger_backpack', 'npc_passenger_suitcase'],
  'line-11': stationNpcIds,
  'line-12': ['npc_passenger_suitcase'],
  'line-13': ['npc_passenger_suitcase'],
};

for (const entry of stationManifest) {
  const owners = Array.isArray(entry.npcIds)
    ? entry.npcIds.filter((npcId) => stationNpcIds.includes(npcId))
    : [];
  if (!owners.length) owners.push(...(legacyOwnersByLine[entry.id] ?? []));
  if (!owners.length) {
    unassignedAudio.push(entry);
    continue;
  }
  for (const npcId of owners) {
    const targetDirectory = join(stationSource, 'npcs', npcId, 'audio');
    await mkdir(targetDirectory, { recursive: true });
    await cp(join(stationAudioRoot, entry.file), join(targetDirectory, entry.file), { force: true });
    audioManifestByNpc.get(npcId).push(entry);
  }
}

for (const [npcId, entries] of audioManifestByNpc) {
  const targetDirectory = join(stationSource, 'npcs', npcId, 'audio');
  await writeFile(join(targetDirectory, 'manifest.json'), `${JSON.stringify(entries, null, 2)}\n`);
}
if (unassignedAudio.length) {
  const tutorialDirectory = join(stationSource, 'audio', 'tutorial');
  await mkdir(tutorialDirectory, { recursive: true });
  for (const entry of unassignedAudio) {
    await cp(join(stationAudioRoot, entry.file), join(tutorialDirectory, entry.file), { force: true });
  }
  await writeFile(join(tutorialDirectory, 'manifest.json'), `${JSON.stringify(unassignedAudio, null, 2)}\n`);
}
results[0].audioFiles = stationManifest.length;
results[0].npcAudioDirectories = stationNpcIds.filter((npcId) => audioManifestByNpc.get(npcId).length > 0);
results[0].unassignedAudioFiles = unassignedAudio.length;

console.log(JSON.stringify(results, null, 2));
