import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

test('all ten café catalog products point to a local generated image', async () => {
  const catalogPath = new URL('../../../content/seed/shops.json', import.meta.url);
  const items = JSON.parse(await readFile(catalogPath, 'utf8'));
  const cafeItems = items.filter(item => item.shop === 'cafe');
  assert.equal(cafeItems.length, 10);

  for (const item of cafeItems) {
    assert.equal(item.image, `/images/shops/${item.id}.webp`);
    const imagePath = new URL(`../public${item.image}`, import.meta.url);
    const file = await stat(fileURLToPath(imagePath));
    assert.ok(file.size > 0);
  }
});
