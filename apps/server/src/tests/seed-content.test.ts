import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { loadSeedContent } from '../infrastructure/content/seed-content';

test('T2 committed content and all scope references validate', async () => {
  const content = await loadSeedContent(resolve('../../content'));
  assert.equal(content.npcs.length, 4);
  assert.equal(content.quests.length, 6);
  assert.deepEqual(new Set(content.dialogues.map(file => file.scope)), new Set(['global', 'npc', 'role']));
});

for (const [name, file, change, expected] of [
  ['NPC reference', 'npc_mia.json', { npcId: 'npc_missing' }, /Unknown dialogue NPC/],
  ['role reference', 'role_barista.json', { role: 'missing_role' }, /Unknown dialogue role/],
  ['scope reference', 'global.json', { npcId: 'npc_mia' }, /Unrecognized key/],
  ['transition reference', 'npc_mia.json', { nodes: [{ id: 'test', text: { default: 'Hello' }, fallback: 'missing' }] }, /unknown dialogue target/],
  ['step reference', 'npc_mia.json', { nodes: [{ id: 'test', text: { default: 'Hello' }, completesStep: 'missing' }] }, /unknown applicable quest step/],
] as const) {
  test(`T2 rejects invalid ${name} before seeding`, async () => {
    const root = await mkdtemp(join(tmpdir(), 't2-content-'));
    try {
      await cp(resolve('../../content'), root, { recursive: true });
      const path = join(root, 'dialogue', file);
      const original = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
      await writeFile(path, JSON.stringify({ ...original, ...change }));
      await assert.rejects(loadSeedContent(root), expected);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
}
