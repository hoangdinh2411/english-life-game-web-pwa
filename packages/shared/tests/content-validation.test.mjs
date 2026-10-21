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

test('content command rejects an NPC without gender', async () => {
  await fixture(async (root) => {
    const path = resolve(root, 'content/seed/npcs.json');
    const npcs = JSON.parse(await readFile(path, 'utf8'));
    delete npcs[0].gender;
    await writeFile(path, JSON.stringify(npcs));
    const result = spawnSync(process.execPath, [validator], { cwd: root, encoding: 'utf8' });
    assert.notEqual(result.status, 0, 'An NPC without gender must fail validation');
    assert.match(result.stderr, /npcs\.json.*0\.gender/s);
  });
});

for (const [name, mutate, diagnostic] of [
  ['missing profile version', (npc) => { delete npc.profile.profileVersion; }, /profile\.profileVersion/s],
  ['unknown profile field', (npc) => { npc.profile.secret = 'not allowed'; }, /profile.*unrecognized key/is],
  ['unsupported profile version', (npc) => { npc.profile.profileVersion = 2; }, /profile\.profileVersion/s],
]) {
  test(`content command rejects ${name}`, async () => {
    await fixture(async (root) => {
      const path = resolve(root, 'content/seed/npcs.json');
      const npcs = JSON.parse(await readFile(path, 'utf8'));
      mutate(npcs[0]);
      await writeFile(path, JSON.stringify(npcs));
      const result = spawnSync(process.execPath, [validator], { cwd: root, encoding: 'utf8' });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, diagnostic);
    });
  });
}

test('every authored NPC has a distinct versioned profile', async () => {
  const catalog = JSON.parse(await readFile(resolve(repository, 'content/seed/npcs.json'), 'utf8'));
  const street = JSON.parse(await readFile(resolve(repository, 'content/seed/street-npcs.json'), 'utf8'));
  const profiles = [...catalog, ...street.npcs].map(npc => JSON.stringify(npc.profile));
  assert.equal(profiles.length, 29);
  assert.equal(new Set(profiles).size, profiles.length);
  assert.ok([...catalog, ...street.npcs].every(npc => npc.profile?.profileVersion === 1));
});

test('mood catalog contains the ten strict editable mood rows', async () => {
  const moods = JSON.parse(await readFile(resolve(repository, 'content/seed/moods.json'), 'utf8'));
  assert.deepEqual(moods.map(mood => mood.id), ['neutral', 'happy', 'hungry', 'stressed', 'tired', 'relaxed', 'sleepy', 'sad', 'upset', 'angry']);
  assert.ok(moods.every(mood => mood.label.trim() && mood.guidance.trim()));
});

test('content command rejects malformed mood rules and mood rows', async () => {
  await fixture(async root => {
    const npcPath = resolve(root, 'content/seed/npcs.json');
    const npcs = JSON.parse(await readFile(npcPath, 'utf8'));
    npcs[0].profile.moodRules = { morningHappy: true, inventedRule: true };
    await writeFile(npcPath, JSON.stringify(npcs));
    let result = spawnSync(process.execPath, [validator], { cwd: root, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /moodRules.*unrecognized key/is);

    npcs[0].profile.moodRules = { exceptional: [{ mood: 'friendly', start: '09:00', end: '10:00', chancePercent: 20 }] };
    await writeFile(npcPath, JSON.stringify(npcs));
    result = spawnSync(process.execPath, [validator], { cwd: root, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /moodRules.*exceptional/is);
  });
});

test('every street NPC has an authored presence schedule with multiple-shift and overnight coverage', async () => {
  const street = JSON.parse(await readFile(resolve(repository, 'content/seed/street-npcs.json'), 'utf8'));
  assert.ok(street.npcs.every(npc => npc.profile.presenceSchedule?.weeklySlots.length));
  assert.ok(street.npcs.some(npc => npc.profile.presenceSchedule.weeklySlots.length > 1));
  assert.ok(street.npcs.some(npc => npc.profile.presenceSchedule.weeklySlots.some(slot => slot.start > slot.end)));
});

test('content command rejects overlapping and unknown-location presence schedules', async () => {
  await fixture(async root => {
    const path = resolve(root, 'content/seed/street-npcs.json');
    const street = JSON.parse(await readFile(path, 'utf8'));
    street.npcs[0].profile.presenceSchedule.weeklySlots = [
      { days: ['mon'], start: '08:00', end: '12:00', locationId: 'loc_town_street' },
      { days: ['mon'], start: '11:00', end: '13:00', locationId: 'loc_town_street' },
    ];
    await writeFile(path, JSON.stringify(street));
    let result = spawnSync(process.execPath, [validator], { cwd: root, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /overlap/i);

    street.npcs[0].profile.presenceSchedule.weeklySlots = [
      { days: ['mon'], start: '08:00', end: '12:00', locationId: 'loc_missing' },
    ];
    await writeFile(path, JSON.stringify(street));
    result = spawnSync(process.execPath, [validator], { cwd: root, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unknown schedule location/i);
  });
});

test('committed content passes', () => {
  const result = spawnSync(process.execPath, [validator], { cwd: repository, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('content command rejects an invalid country catalog', async () => {
  await fixture(async (root) => {
    const path = resolve(root, 'content/seed/countries.json');
    const countries = JSON.parse(await readFile(path, 'utf8'));
    countries[0].timeZone = 'Stockholm';
    await writeFile(path, JSON.stringify(countries));
    const result = spawnSync(process.execPath, [validator], { cwd: root, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /countries\.json.*time zone/is);
  });
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
  ['dialogue/common/role_barista.json', (data) => { delete data.role; }, /role_barista\.json.*role/s],
  ['dialogue/common/greetings.json', (data) => { data.npcId = 'npc_mia'; }, /greetings\.json/s],
  ['dialogue/npc_mia.json', (data) => { data.nodes[0].text.default = ''; }, /npc_mia\.json.*text\.default/s],
  ['dialogue/common/greetings.json', (data) => { data.version = 0; }, /greetings\.json.*version/s],
  ['dialogue/common/greetings.json', (data) => { data.nodes[0].intents[0].keywords = []; }, /greetings\.json.*keywords/s],
  ['dialogue/common/greetings.json', (data) => { data.nodes[0].context = { timeReference: 'yesterday' }; }, /greetings\.json.*timeReference/s],
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
