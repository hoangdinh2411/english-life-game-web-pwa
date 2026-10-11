import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repository = fileURLToPath(new URL('../../../', import.meta.url));
const validator = resolve(repository, 'scripts/onboarding-content.mjs');

async function fixture(run) {
  const root = await mkdtemp(resolve(tmpdir(), 'life-abroad-content-'));
  try {
    await cp(resolve(repository, 'content'), resolve(root, 'content'), { recursive: true });
    await cp(resolve(repository, 'packages/shared/src/dialogue/content'), resolve(root, 'packages/shared/src/dialogue/content'), { recursive: true });
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('content command rejects a broken NPC with file and field diagnostics', async () => {
  await fixture(async (root) => {
    const path = resolve(root, 'content/seed/npcs.json');
    const npcs = JSON.parse(await readFile(path, 'utf8'));
    npcs[0].speakingLevel = 'A9';
    await writeFile(path, JSON.stringify(npcs));
    const result = spawnSync(process.execPath, [validator], { cwd: root, encoding: 'utf8' });
    assert.notEqual(result.status, 0, 'Invalid NPC content must fail validation');
    assert.match(result.stderr, /npcs\.json.*0\.speakingLevel/s);
  });
});

test('committed content passes', () => {
  const result = spawnSync(process.execPath, [validator], { cwd: repository, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

// Invalid catalog data must fail the actual content command, not just a schema helper.
for (const [name, item, diagnostic] of [
  ['missing price', { id: 'test_drink', name: 'Test drink', kind: 'drink', shop: 'cafe' }, /shops\.json.*0\.price/s],
  ['unknown shop', { id: 'test_drink', name: 'Test drink', kind: 'drink', price: 2, shop: 'unknown' }, /shops\.json.*0\.shop/s],
]) {
  test(`shop catalog command rejects ${name}`, async () => {
    await fixture(async root => {
      await writeFile(resolve(root, 'content/seed/shops.json'), JSON.stringify([item]));
      const result = spawnSync(process.execPath, [validator], { cwd: root, encoding: 'utf8' });
      assert.notEqual(result.status, 0, 'Invalid shop catalog must fail validation');
      assert.match(result.stderr, diagnostic);
    });
  });
}

for (const [file, change, diagnostic] of [
  ['seed/quests.json', (data) => { data[0].rewards.xp = -1; }, /quests\.json.*0\.rewards\.xp/s],
  ['seed/quests.json', (data) => { data[0].steps[0].doneWhen.intent = ''; }, /quests\.json.*doneWhen\.intent/s],
  ['seed/npcs.json', (data) => { data[0].locationId = 'Invalid ID'; }, /npcs\.json.*locationId/s],
  ['dialogue/role_barista.json', (data) => { delete data.role; }, /role_barista\.json.*role/s],
  ['dialogue/global.json', (data) => { data.npcId = 'npc_mia'; }, /global\.json/s],
  ['dialogue/npc_mia.json', (data) => { data.nodes[0].text.default = ''; }, /npc_mia\.json.*text\.default/s],
  ['dialogue/global.json', (data) => { data.version = 0; }, /global\.json.*version/s],
  ['dialogue/global.json', (data) => { data.nodes[0].intents[0].keywords = []; }, /global\.json.*keywords/s],
  ['dialogue/global.json', (data) => { data.nodes[0].context = { timeReference: 'yesterday' }; }, /global\.json.*timeReference/s],
  ['seed/quests.json', (data) => { data[0].steps.push(data[0].steps[0]); }, /quests\.json.*unique/s],
]) {
  test(`rejects malformed ${file}: ${diagnostic}`, async () => {
    await fixture(async (root) => {
      const path = resolve(root, 'content', file);
      const data = JSON.parse(await readFile(path, 'utf8'));
      change(data);
      await writeFile(path, JSON.stringify(data));
      const result = spawnSync(process.execPath, [validator], { cwd: root, encoding: 'utf8' });
      assert.notEqual(result.status, 0, 'Malformed content must fail');
      assert.match(result.stderr, diagnostic);
    });
  });
}

test('invalid JSON names the source file', async () => {
  await fixture(async (root) => {
    await writeFile(resolve(root, 'content/seed/quests.json'), '{');
    const result = spawnSync(process.execPath, [validator], { cwd: root, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /quests\.json.*JSON/s);
  });
});
