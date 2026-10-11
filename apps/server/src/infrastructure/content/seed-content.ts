import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { dialogueSchema, npcCatalogSchema, questCatalogSchema, shopCatalogSchema, townSeedSchema } from '@life-abroad/shared';

async function json(path: string): Promise<unknown> {
  try { return JSON.parse(await readFile(path, 'utf8')) as unknown; }
  catch { throw new Error(`${path}: could not read JSON`); }
}

export async function loadSeedContent(root: string) {
  const town = townSeedSchema.parse(await json(join(root, 'seed/town.json')));
  const npcs = npcCatalogSchema.parse(await json(join(root, 'seed/npcs.json')));
  const quests = questCatalogSchema.parse(await json(join(root, 'seed/quests.json')));
  const shops = shopCatalogSchema.parse(await json(join(root, 'seed/shops.json')));
  const dialogues = [];
  for (const file of (await readdir(join(root, 'dialogue'), { recursive: true })).filter(file => file.endsWith('.json')).sort()) {
    dialogues.push(dialogueSchema.parse(await json(join(root, 'dialogue', file))));
  }
  if (dialogues.length === 0) throw new Error('No authored dialogue files found');
  const roles = [...new Set(npcs.map(npc => npc.role))];
  const locations = new Set(town.locations.map(location => location.id));
  const npcIds = new Set(npcs.map(npc => npc.id));
  const nodes = new Set<string>();
  const requireReference = (valid: boolean, message: string): void => {
    if (!valid) throw new Error(message);
  };
  for (const npc of npcs) requireReference(locations.has(npc.locationId), `${npc.id}: unknown location ${npc.locationId}`);
  for (const quest of quests) requireReference(npcIds.has(quest.npcId), `${quest.id}: unknown NPC ${quest.npcId}`);
  for (const dialogue of dialogues) {
    if (dialogue.scope === 'role') requireReference(roles.includes(dialogue.role), `Unknown dialogue role ${dialogue.role}`);
    if (dialogue.scope === 'npc') requireReference(npcIds.has(dialogue.npcId), `Unknown dialogue NPC ${dialogue.npcId}`);
    for (const node of dialogue.nodes) {
      requireReference(!nodes.has(node.id), `Duplicate dialogue node ${node.id}`);
      nodes.add(node.id);
    }
  }
  for (const dialogue of dialogues) for (const node of dialogue.nodes) {
    for (const target of [...(node.intents ?? []).map(intent => intent.next), ...(node.fallback ? [node.fallback] : [])]) {
      requireReference(nodes.has(target), `${node.id}: unknown dialogue target ${target}`);
    }
    if (node.completesStep) {
      requireReference(quests.some(quest => {
        const npc = npcs.find(candidate => candidate.id === quest.npcId);
        const applies = dialogue.scope === 'global' || (dialogue.scope === 'npc' ? quest.npcId === dialogue.npcId : npc?.role === dialogue.role);
        return applies && quest.steps.some(step => step.id === node.completesStep);
      }), `${node.id}: unknown applicable quest step ${node.completesStep}`);
    }
  }
  return { town, roles, npcs, quests, shops, dialogues };
}

export type SeedContent = Awaited<ReturnType<typeof loadSeedContent>>;
