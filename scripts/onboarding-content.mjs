import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseOnboardingOptions, dialogueSchema, npcCatalogSchema, questCatalogSchema, shopCatalogSchema, streetNpcContentSchema, practiceDialogueNodeSchema } from '../packages/shared/dist/index.js';

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
validate('content/seed/npcs.json + street-npcs.json', npcCatalogSchema, [
  ...npcCatalog,
  ...streetNpcContent.npcs.map(({ id, name, gender, role, personality, speakingLevel, locationId, bio }) => ({ id, name, gender, role, personality, speakingLevel, locationId, bio })),
]);
validate('content/seed/quests.json', questCatalogSchema, await readJson('content/seed/quests.json'));
validate('content/seed/shops.json', shopCatalogSchema, await readJson('content/seed/shops.json'));

const town = JSON.parse(await readFile(resolve('content/seed/town.json'), 'utf8'));
const avatars = JSON.parse(await readFile(resolve('content/seed/avatars.json'), 'utf8'));
if (town.isStarterCity !== true) throw new Error('town.json must explicitly mark the starter city.');
const options = parseOnboardingOptions({ cities: [{ id: town.id, name: town.name, description: town.description }], avatars });
if (options.cities.length === 0 || options.avatars.length === 0) throw new Error('At least one starter city and avatar are required.');
process.stdout.write(`Validated ${options.cities.length} starter city and ${options.avatars.length} avatar options.\n`);

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
