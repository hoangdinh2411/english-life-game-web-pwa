import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import npcContent from '../../../content/seed/npcs.json' with { type: 'json' };
import streetContent from '../../../content/seed/street-npcs.json' with { type: 'json' };
import { npcPortraitPosition } from '../src/features/npcs/npc-expression.ts';
import { alphaBounds, decodeRgbaPng } from './png-alpha.mjs';

const destinationNpcs = [...npcContent.filter(npc => npc.walkImageUrl), ...streetContent.npcs];
const FRAME_WIDTH = 128;
const FRAME_HEIGHT = 192;

function cellDifference(image, firstColumn, firstRow, secondColumn, secondRow) {
  let difference = 0;
  for (let y = 0; y < FRAME_HEIGHT; y += 1) for (let x = 0; x < FRAME_WIDTH; x += 1) {
    const first = ((firstRow * FRAME_HEIGHT + y) * image.width + firstColumn * FRAME_WIDTH + x) * 4;
    const second = ((secondRow * FRAME_HEIGHT + y) * image.width + secondColumn * FRAME_WIDTH + x) * 4;
    for (let channel = 0; channel < 4; channel += 1) difference += Math.abs(image.data[first + channel] - image.data[second + channel]);
  }
  return difference / (FRAME_WIDTH * FRAME_HEIGHT * 4);
}

function assertSideFramesAreMirrored(image, npcId) {
  for (let step = 0; step < 4; step += 1) {
    let difference = 0;
    for (let y = 0; y < FRAME_HEIGHT; y += 1) for (let x = 0; x < FRAME_WIDTH; x += 1) {
      const left = ((FRAME_HEIGHT + y) * image.width + step * FRAME_WIDTH + x) * 4;
      const right = ((FRAME_HEIGHT * 2 + y) * image.width + step * FRAME_WIDTH + (FRAME_WIDTH - 1 - x)) * 4;
      for (let channel = 0; channel < 4; channel += 1) difference += Math.abs(image.data[left + channel] - image.data[right + channel]);
    }
    assert.ok(difference / (FRAME_WIDTH * FRAME_HEIGHT * 4) < 0.1, `${npcId} step ${step} uses mirrored left/right artwork`);
  }
}

test('every destination NPC owns a walking sheet and three-expression portrait strip', async () => {
  assert.equal(destinationNpcs.length, 26);
  assert.equal(new Set(destinationNpcs.map(npc => npc.walkImageUrl)).size, 26);
  assert.equal(new Set(destinationNpcs.map(npc => npc.portrait.imageUrl)).size, 26);
  for (const npc of destinationNpcs) {
    const walk = await readFile(new URL(`../assets/${npc.walkImageUrl}`, import.meta.url));
    const portraits = await readFile(new URL(`../assets/${npc.portrait.imageUrl}`, import.meta.url));
    assert.deepEqual([walk.readUInt32BE(16), walk.readUInt32BE(20), walk[25]], [512, 768, 6], `${npc.id} walk sheet`);
    assert.deepEqual([portraits.readUInt32BE(16), portraits.readUInt32BE(20), portraits[25]], [768, 256, 6], `${npc.id} portraits`);
    const walkImage = decodeRgbaPng(walk);
    assertSideFramesAreMirrored(walkImage, npc.id);
    for (let direction = 0; direction < 4; direction += 1) {
      const frames = Array.from({ length: 4 }, (_, step) => alphaBounds(walkImage, step * FRAME_WIDTH, direction * FRAME_HEIGHT, FRAME_WIDTH, FRAME_HEIGHT));
      assert.ok(frames.every(frame => frame.height >= 150 && frame.height <= 162 && frame.bottom <= 188), `${npc.id} direction ${direction} uses the shared visual box`);
      assert.ok(Math.max(...frames.map(frame => frame.height)) - Math.min(...frames.map(frame => frame.height)) <= 9, `${npc.id} direction ${direction} keeps a consistent character scale`);
      assert.ok(frames.every(frame => Math.abs((frame.left + frame.right) / 2 - 63.5) <= 12), `${npc.id} direction ${direction} stays horizontally centered`);
      assert.ok(cellDifference(walkImage, 0, direction, 2, direction) >= 3, `${npc.id} direction ${direction} has an opposite-contact animation frame`);
      assert.ok(cellDifference(walkImage, 1, direction, 3, direction) >= 2, `${npc.id} direction ${direction} has distinct passing animation frames`);
    }
    for (let direction = 1; direction < 4; direction += 1) {
      assert.ok(cellDifference(walkImage, 0, 0, 0, direction) >= 8, `${npc.id} direction ${direction} is visually distinct from down`);
    }
    const portraitImage = decodeRgbaPng(portraits);
    for (let expression = 0; expression < 3; expression += 1) {
      const frame = alphaBounds(portraitImage, expression * 256, 0, 256, 256);
      assert.ok(frame.height >= 180 && frame.top >= 4 && frame.bottom <= 251, `${npc.id} expression ${expression} fits vertically`);
      assert.ok(Math.abs((frame.left + frame.right) / 2 - 127.5) <= 5, `${npc.id} expression ${expression} is centered`);
    }
    assert.deepEqual(npc.portrait, { imageUrl: `npcs/${npc.id}/portraits.png`, index: 0, columns: 3, rows: 1 });
  }
});

test('dialogue portraits select neutral, happy and concerned expressions', () => {
  assert.equal(npcPortraitPosition('Good morning.'), '0% 0%');
  assert.equal(npcPortraitPosition('Welcome!'), '50% 0%');
  assert.equal(npcPortraitPosition('Sorry, the shop is closed.'), '100% 0%');
  assert.equal(npcPortraitPosition('', true), '100% 0%');
});
