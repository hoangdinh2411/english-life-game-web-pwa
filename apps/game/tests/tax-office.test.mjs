import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// Catches either clerk being anonymous, duplicated, assigned the wrong gender, or missing staff-identifying content.
test('Tax Office has one uniquely named male clerk and one uniquely named female clerk', async () => {
  const npcs = JSON.parse(await readFile(new URL('../../../content/seed/npcs.json', import.meta.url), 'utf8'));
  const staff = npcs.filter(npc => npc.locationId === 'loc_tax_office');
  assert.equal(staff.length, 2);
  assert.deepEqual(staff.map(npc => npc.gender).sort(), ['female', 'male']);
  assert.equal(new Set(npcs.map(npc => npc.name)).size, npcs.length);
  for (const clerk of staff) {
    assert.equal(clerk.role, 'tax_office_staff');
    assert.match(clerk.bio, /tax office/i);
    assert.deepEqual(clerk.portrait, { imageUrl: `npcs/${clerk.id}/portraits.png`, index: 0, columns: 3, rows: 1 });
  }
});
