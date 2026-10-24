import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';

function pngSize(bytes) {
  assert.equal(bytes.toString('ascii', 1, 4), 'PNG');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', ssr: { external: ['@life-abroad/shared'] } });
try {
  const { playerAssets } = await server.ssrLoadModule('/src/features/appearance/player-assets.ts');

  // A selected female player must use player-sized art, never a large NPC sheet.
  test('female and male player assets share one 32x48 runtime geometry', async () => {
    const female = playerAssets('female');
    const male = playerAssets('male');
    assert.deepEqual(female.frame, { width: 32, height: 48 });
    assert.deepEqual(male.frame, { width: 32, height: 48 });
    assert.equal(female.displayScale, 2);
    assert.equal(male.displayScale, 2);
    assert.notEqual(female.sheet, male.sheet);
    assert.match(female.sheet, /player-female-smooth\.png/);
    assert.notEqual(female.portrait, male.portrait);
    assert.deepEqual(pngSize(await readFile(new URL('../assets/runtime/player-female-smooth.png', import.meta.url))), { width: 128, height: 192 });
    assert.deepEqual(pngSize(await readFile(new URL('../assets/runtime/player-female-portrait.png', import.meta.url))), { width: 256, height: 256 });
  });
} finally {
  await server.close();
}
