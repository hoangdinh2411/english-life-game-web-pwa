import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import { createServer } from 'vite';

function pngSize(bytes) {
  assert.equal(bytes.toString('ascii', 1, 4), 'PNG');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function decodeRgbaPng(bytes) {
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const chunks = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    if (bytes.toString('ascii', offset + 4, offset + 8) === 'IDAT') chunks.push(bytes.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * 4;
  for (let y = 0; y < height; y++) assert.equal(raw[y * (stride + 1)], 0, 'sprite PNG rows use filter 0');
  return { width, height, raw };
}

function visibleFrameBounds(image, frameWidth, frameHeight) {
  const frames = [];
  const stride = image.width * 4;
  for (let row = 0; row < 4; row++) for (let column = 0; column < 4; column++) {
    let left = frameWidth;
    let right = -1;
    let top = frameHeight;
    let bottom = -1;
    for (let y = row * frameHeight; y < (row + 1) * frameHeight; y++) for (let x = column * frameWidth; x < (column + 1) * frameWidth; x++) {
      if (image.raw[y * (stride + 1) + 1 + x * 4 + 3] < 16) continue;
      left = Math.min(left, x - column * frameWidth);
      right = Math.max(right, x - column * frameWidth);
      top = Math.min(top, y - row * frameHeight);
      bottom = Math.max(bottom, y - row * frameHeight);
    }
    assert.notEqual(bottom, -1, `frame ${row},${column} must contain visible pixels`);
    frames.push({ width: right - left + 1, height: bottom - top + 1 });
  }
  return frames;
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

const server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom', ssr: { external: ['@life-abroad/shared'] } });
try {
  const { playerAssets, playerWalkFrame } = await server.ssrLoadModule('/src/features/appearance/player-assets.ts');
  const { practiceStationAtlases, savedPlayerAtlas } = await server.ssrLoadModule('/src/gameplay/station-assets.ts');
  const { NPC_DISPLAY_SCALE, NPC_VISIBLE_HEIGHT, WORLD_NPC_VISIBLE_HEIGHT } = await server.ssrLoadModule('/src/features/npcs/actor-display.ts');

  test('saved male art uses the NPC-sized atlas while practice and female art keep compact frames', async () => {
    const female = playerAssets('female');
    const male = playerAssets('male');
    assert.deepEqual(female.frame, { width: 32, height: 48 });
    assert.deepEqual(male.frame, { width: 128, height: 192 });
    assert.equal(female.displayScale, 2);
    assert.equal(male.displayScale, NPC_DISPLAY_SCALE);
    assert.notEqual(female.sheet, male.sheet);
    assert.match(female.sheet, /player-female-smooth\.png/);
    assert.match(male.sheet, /player-male\.png/);
    assert.notEqual(female.portrait, male.portrait);
    assert.deepEqual(pngSize(await readFile(new URL('../assets/runtime/player-female-smooth.png', import.meta.url))), { width: 128, height: 192 });
    assert.deepEqual(pngSize(await readFile(new URL('../assets/runtime/player-female-portrait.png', import.meta.url))), { width: 256, height: 256 });
    assert.deepEqual(pngSize(await readFile(new URL('../assets/runtime/player-male.png', import.meta.url))), { width: 512, height: 768 });
    assert.deepEqual(savedPlayerAtlas('male').data.frames['0-0'].frame, { x: 0, y: 0, w: 128, h: 192 });
    assert.deepEqual(savedPlayerAtlas('female').data.frames['0-0'].frame, { x: 0, y: 0, w: 32, h: 48 });
    assert.ok(practiceStationAtlases.every(atlas => atlas.key !== 'player-male'), 'practice mode must not fetch the larger saved-player atlas');
  });

  test('male frame height and width align with Nadia after rendering at the NPC scale', async () => {
    const playerBytes = await readFile(new URL('../assets/runtime/player-male.png', import.meta.url));
    const nadiaBytes = await readFile(new URL('../../../local-assets/maps/loc_tax_office/npc-npc_tax_clerk_nadia.png', import.meta.url));
    const { width, height } = pngSize(playerBytes);
    const { frame } = playerAssets('male');
    assert.deepEqual({ width, height }, { width: frame.width * 4, height: frame.height * 4 });
    const playerImage = decodeRgbaPng(playerBytes);
    const nadiaImage = decodeRgbaPng(nadiaBytes);
    assert.deepEqual({ width: nadiaImage.width, height: nadiaImage.height }, { width: frame.width * 4, height: frame.height * 4 });
    const playerFrames = visibleFrameBounds(playerImage, frame.width, frame.height);
    const nadiaFrames = visibleFrameBounds(nadiaImage, frame.width, frame.height);
    const displayScale = playerAssets('male').displayScale;
    assert.equal(median(nadiaFrames.map(frameBounds => frameBounds.height)), NPC_VISIBLE_HEIGHT);
    for (const [index, bounds] of playerFrames.entries()) {
      const displayedHeight = bounds.height * displayScale;
      assert.ok(Math.abs(displayedHeight - WORLD_NPC_VISIBLE_HEIGHT) <= 2,
        `male frame ${index} should match NPC height, received ${displayedHeight}`);
    }
    const playerWidth = median(playerFrames.map(bounds => bounds.width)) * displayScale;
    const nadiaWidth = median(nadiaFrames.map(bounds => bounds.width)) * NPC_DISPLAY_SCALE;
    assert.ok(Math.abs(playerWidth - nadiaWidth) / nadiaWidth <= 0.12,
      `expected player width to stay within 12% of Nadia, got ${playerWidth} versus ${nadiaWidth}`);
  });

  test('destination maps can reload either saved player atlas after station cleanup', () => {
    assert.equal(savedPlayerAtlas('male').key, 'player-male');
    assert.equal(savedPlayerAtlas('female').key, 'player-female');
  });

  test('saved characters use all four named atlas rows on destination maps', () => {
    for (let row = 0; row < 4; row++) {
      assert.deepEqual(Array.from({ length: 4 }, (_, column) => playerWalkFrame(row, column, false)),
        Array.from({ length: 4 }, (_, column) => `${row}-${column}`));
    }
    assert.equal(playerWalkFrame(3, 2, true), 14);
  });
} finally {
  await server.close();
}
