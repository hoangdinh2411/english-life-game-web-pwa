import { readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { dialogueSchema, moodCatalogSchema, npcCatalogSchema, questCatalogSchema, SHOP_NPC_IDS, shopCatalogSchema, streetNpcContentSchema, practiceDialogueNodeSchema, voicePoolsSchema } from '../packages/shared/dist/index.js';

async function readJson(file) {
  try {
    return JSON.parse(await readFile(resolve(file), 'utf8'));
  } catch (error) {
    throw new Error(`${file}: could not read JSON: ${error.message}`);
  }
}

function validate(file, schema, content) {
  const result = schema.safeParse(content);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`);
    throw new Error(`${file}:\n${issues.join('\n')}`);
  }
}

const npcCatalog = await readJson('content/seed/npcs.json');
const streetNpcContent = await readJson('content/seed/street-npcs.json');
validate('content/seed/street-npcs.json', streetNpcContentSchema, streetNpcContent);
validate('content/seed/npcs.json', npcCatalogSchema, npcCatalog);
const voicePools = await readJson('content/voice-pools.json');
validate('content/voice-pools.json', voicePoolsSchema, voicePools);
validate('content/seed/npcs.json + street-npcs.json', npcCatalogSchema, [
  ...npcCatalog,
  ...streetNpcContent.npcs.map(({ id, name, gender, role, personality, speakingLevel, locationId, bio, profile }) => ({ id, name, gender, role, personality, speakingLevel, locationId, bio, profile })),
]);
const npcIds = new Set([...npcCatalog, ...streetNpcContent.npcs].map(npc => npc.id));
for (const npcId of Object.keys(voicePools.voiceOverrides)) {
  if (!npcIds.has(npcId)) throw new Error(`content/voice-pools.json: unknown NPC ${npcId}`);
}
validate('content/seed/quests.json', questCatalogSchema, await readJson('content/seed/quests.json'));
validate('content/seed/shops.json', shopCatalogSchema, await readJson('content/seed/shops.json'));
validate('content/seed/moods.json', moodCatalogSchema, await readJson('content/seed/moods.json'));

const town = JSON.parse(await readFile(resolve('content/seed/town.json'), 'utf8'));
const locationIds = new Set(town.locations.map(location => location.id));
for (const npc of [...npcCatalog, ...streetNpcContent.npcs]) for (const slot of npc.profile.presenceSchedule?.weeklySlots ?? []) {
  if (!locationIds.has(slot.locationId)) throw new Error(`${npc.id}: unknown schedule location ${slot.locationId}`);
  if (slot.locationId !== npc.locationId) throw new Error(`${npc.id}: schedule location must match the NPC location`);
  if (SHOP_NPC_IDS.includes(npc.id) && !(slot.start >= '08:00' && slot.end <= '14:00' && slot.start < slot.end)) {
    throw new Error(`${npc.id}: store schedule must stay within venue hours`);
  }
}
if (town.isStarterCity !== true) throw new Error('town.json must explicitly mark the starter city.');
const countryGenerator = resolve(import.meta.dirname, 'generate-country-worlds-migration.mjs');
const countryValidation = spawnSync(process.execPath, [countryGenerator, '--root', '.', '--check'], { encoding: 'utf8' });
if (countryValidation.status !== 0) throw new Error(countryValidation.stderr || countryValidation.stdout || 'Country catalog validation failed.');
const avatars = JSON.parse(await readFile(resolve('content/seed/avatars.json'), 'utf8'));
if (!Array.isArray(avatars) || avatars.length === 0) throw new Error('At least one avatar is required.');
process.stdout.write(countryValidation.stdout);

for (const file of await readdir(resolve('content/dialogue'), { recursive: true })) {
  if (!file.endsWith('.json')) continue;
  const path = `content/dialogue/${file}`;
  validate(path, dialogueSchema, await readJson(path));
}
const station = JSON.parse(await readFile(resolve('packages/shared/src/dialogue/content/station.json'), 'utf8'));
for (const [id, node] of Object.entries(station.nodes)) {
  const result = practiceDialogueNodeSchema.safeParse(node);
  if (!result.success) throw new Error(`station.json: ${id}: ${result.error.message}`);
}
process.stdout.write('Validated NPCs, quests, shop items, authored dialogue and station practice nodes.\n');
