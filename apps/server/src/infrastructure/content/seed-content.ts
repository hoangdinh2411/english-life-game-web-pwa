import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { dialogueSchema, idCardApplicationContentSchema, moodCatalogSchema, npcCatalogSchema, questCatalogSchema, SHOP_NPC_IDS, shopCatalogSchema, streetNpcContentSchema, townSeedSchema, VENUE_HOURS, voicePoolsSchema } from '@life-abroad/shared';

async function json(path: string): Promise<unknown> {
  try { return JSON.parse(await readFile(path, 'utf8')) as unknown; }
  catch { throw new Error(`${path}: could not read JSON`); }
}

export async function loadSeedContent(root: string) {
  const moods = moodCatalogSchema.parse(await json(join(root, 'seed/moods.json')));
  const town = townSeedSchema.parse(await json(join(root, 'seed/town.json')));
  const catalogNpcs = npcCatalogSchema.parse(await json(join(root, 'seed/npcs.json')));
  const streetNpcs = streetNpcContentSchema.parse(await json(join(root, 'seed/street-npcs.json')));
  const npcs = npcCatalogSchema.parse([...catalogNpcs, ...streetNpcs.npcs.map(npc => ({
    id: npc.id, name: npc.name, gender: npc.gender, role: npc.role, personality: npc.personality,
    speakingLevel: npc.speakingLevel, locationId: npc.locationId, bio: npc.bio, profile: { ...npc.profile, job: npc.job },
    portrait: npc.portrait,
  }))]);
  const quests = questCatalogSchema.parse(await json(join(root, 'seed/quests.json')));
  const shops = shopCatalogSchema.parse(await json(join(root, 'seed/shops.json')));
  const voicePools = voicePoolsSchema.parse(await json(join(root, 'voice-pools.json')));
  idCardApplicationContentSchema.parse(await json(join(root, 'id-card/application.json')));
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
  for (const npc of npcs) {
    requireReference(locations.has(npc.locationId), `${npc.id}: unknown location ${npc.locationId}`);
    for (const slot of npc.profile.presenceSchedule?.weeklySlots ?? []) {
      requireReference(locations.has(slot.locationId), `${npc.id}: unknown schedule location ${slot.locationId}`);
      requireReference(slot.locationId === npc.locationId, `${npc.id}: schedule location must match the NPC location`);
      if ((SHOP_NPC_IDS as readonly string[]).includes(npc.id)) {
        const kind = slot.locationId === 'loc_cafe' || slot.locationId === 'loc_corner_cafe' ? 'cafe' : 'store';
        const [opens, closes] = VENUE_HOURS[kind];
        const opening = `${String(opens).padStart(2, '0')}:00`;
        const closing = `${String(closes).padStart(2, '0')}:00`;
        requireReference(slot.start >= opening && slot.end <= closing && slot.start < slot.end,
          `${npc.id}: ${kind} schedule must stay within venue hours`);
      }
    }
  }
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
  for (const npcId of Object.keys(voicePools.voiceOverrides)) requireReference(npcIds.has(npcId), `Unknown voice override NPC ${npcId}`);
  return { moods, town, roles, npcs, streetNpcs, quests, shops, dialogues, voicePools };
}

export type SeedContent = Awaited<ReturnType<typeof loadSeedContent>>;
