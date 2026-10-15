import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dialogueSchema, streetNpcContentSchema } from '../packages/shared/dist/index.js';

export async function streetVoiceLines() {
  const catalog = streetNpcContentSchema.parse(JSON.parse(await readFile(new URL('../content/seed/street-npcs.json', import.meta.url), 'utf8')));
  const directory = new URL('../content/dialogue/common/', import.meta.url);
  const files = await Promise.all((await readdir(directory)).filter(file => file.endsWith('.json')).sort()
    .map(async file => dialogueSchema.parse(JSON.parse(await readFile(new URL(file, directory), 'utf8')))));
  const clips = new Map();
  for (const npc of catalog.npcs) for (const file of files.filter(file => file.scope === 'global' || file.scope === 'role' && file.role === npc.role)) {
    for (const node of file.nodes) for (const text of node.variations ?? [node.text[npc.personality] ?? node.text.default]) {
      // Store-hours templates apply to shops, never to Town Street residents.
      if (/\{\w+\}/.test(text)) continue;
      const voice = npc.voice === 'female' ? 'af_heart' : 'am_michael';
      const key = `street-voice-${createHash('sha256').update(`${voice}:0.95:${text}`).digest('hex').slice(0, 16)}`;
      clips.set(key, { key, text, gender: npc.voice, voice });
    }
  }
  return [...clips.values()].sort((a, b) => a.key.localeCompare(b.key));
}
