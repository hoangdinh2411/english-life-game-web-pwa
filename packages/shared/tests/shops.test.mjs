import test from 'node:test';
import assert from 'node:assert/strict';
import { shopCatalogSchema } from '../dist/index.js';

const item = { id: 'test_drink', name: 'Test drink', kind: 'drink', price: 2, shop: 'cafe' };

test('shop catalog preserves authored data and rejects invalid money or ambiguous IDs', () => {
  assert.deepEqual(shopCatalogSchema.parse([item]), [item]);
  for (const price of [-1, 0, 0.5, '2', null, Infinity, 2147483648]) {
    assert.equal(shopCatalogSchema.safeParse([{ ...item, price }]).success, false);
  }
  assert.equal(shopCatalogSchema.safeParse([item, item]).success, false);
  assert.equal(shopCatalogSchema.safeParse([{ ...item, kind: 'unknown' }]).success, false);
  assert.equal(shopCatalogSchema.safeParse([{ ...item, name: ' ' }]).success, false);
  assert.equal(shopCatalogSchema.safeParse([{ ...item, price: undefined }]).success, false);
  assert.equal(shopCatalogSchema.safeParse([{ ...item, shop: 'unknown' }]).success, false);
});
