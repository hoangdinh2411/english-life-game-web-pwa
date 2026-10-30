import assert from 'node:assert/strict';
import test from 'node:test';
import npcContent from '../../../content/seed/npcs.json' with { type: 'json' };
import streetContent from '../../../content/seed/street-npcs.json' with { type: 'json' };
import { npcPortraitPosition } from '../src/features/npcs/npc-expression.ts';

const destinationNpcs = [...npcContent.filter(npc => npc.walkImageUrl), ...streetContent.npcs];

test('every destination NPC declares unique Storage artwork identities', () => {
  assert.equal(destinationNpcs.length, 28);
  assert.equal(new Set(destinationNpcs.map(npc => npc.walkImageUrl)).size, destinationNpcs.length);
  assert.equal(new Set(destinationNpcs.map(npc => npc.portrait.imageUrl)).size, destinationNpcs.length);
  for (const npc of destinationNpcs) {
    assert.equal(npc.walkImageUrl, `npcs/${npc.id}/walk.png`);
    assert.deepEqual(npc.portrait, { imageUrl: `npcs/${npc.id}/portraits.png`, index: 0, columns: 3, rows: 1 });
  }
});

test('dialogue portraits select neutral, happy and concerned expressions', () => {
  assert.equal(npcPortraitPosition('Good morning.'), '0% 0%');
  assert.equal(npcPortraitPosition('Welcome!'), '50% 0%');
  assert.equal(npcPortraitPosition('Sorry, the shop is closed.'), '100% 0%');
  assert.equal(npcPortraitPosition('', true), '100% 0%');
});
