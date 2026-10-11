import assert from 'node:assert/strict';
import test from 'node:test';
import { recolorPlayerPixels } from '../src/features/appearance/player-colors.ts';

const appearance = { hair: 'blond', shirt: 'red', trousers: 'charcoal' };
// Catches whole-sprite tint, lost alpha, or a region ignoring its saved color.
test('independent station colors preserve skin, alpha, and unrelated artwork', () => {
  const pixels = new Uint8ClampedArray(32 * 48 * 4);
  const put = (x, y, color) => pixels.set(color, (y * 32 + x) * 4);
  put(16, 8, [90, 65, 60, 200]);
  put(16, 24, [48, 112, 128, 180]);
  put(16, 37, [65, 48, 45, 220]);
  put(16, 16, [224, 176, 112, 170]);
  put(24, 28, [90, 65, 60, 160]);
  const result = recolorPlayerPixels(pixels, 32, appearance, false);
  const at = (x, y) => Array.from(result.slice((y * 32 + x) * 4, (y * 32 + x) * 4 + 4));
  assert.ok(at(16, 8)[0] > at(16, 8)[2], 'blond hair has warm highlights');
  assert.notDeepEqual(at(16, 8), [90, 65, 60, 200]);
  assert.ok(at(16, 24)[0] > at(16, 24)[2], 'red shirt');
  assert.equal(at(16, 24)[3], 180);
  assert.equal(at(16, 37)[0], at(16, 37)[1], 'charcoal trousers');
  assert.deepEqual(at(16, 16), [224, 176, 112, 170]);
  assert.deepEqual(at(24, 28), [90, 65, 60, 160]);
  assert.equal(result.length, pixels.length);
  assert.equal(pixels[(24 * 32 + 16) * 4], 48, 'source remains untouched');
});

// Catches sheet-global masks that color only the first frame or recolor faces.
test('all sixteen destination frames keep skin and gain independent materials', () => {
  const pixels = new Uint8ClampedArray(128 * 192 * 4);
  const offset = (column, row, x, y) => ((row * 48 + y) * 128 + column * 32 + x) * 4;
  for (let row = 0; row < 4; row++) for (let column = 0; column < 4; column++) {
    pixels.set([222, 180, 138, 255], offset(column, row, 16, 10));
    pixels.set([66, 111, 97, 255], offset(column, row, 16, 24));
    pixels.set([51, 72, 94, 255], offset(column, row, 12, 37));
  }
  const result = recolorPlayerPixels(pixels, 128, appearance, true);
  for (let row = 0; row < 4; row++) for (let column = 0; column < 4; column++) {
    const at = (x, y) => Array.from(result.slice(offset(column, row, x, y), offset(column, row, x, y) + 4));
    assert.deepEqual(at(16, 10), [222, 180, 138, 255]);
    assert.deepEqual(at(16, 24), [187, 60, 58, 255]);
    assert.deepEqual(at(12, 37), [60, 60, 60, 255]);
    assert.deepEqual(at(16, 2), [210, 170, 76, 255]);
  }
});

test('unowned shirt leaves original clothing and preserves darker shading', () => {
  const pixels = new Uint8ClampedArray(32 * 48 * 4);
  pixels.set([48, 112, 128, 120], (24 * 32 + 16) * 4);
  pixels.set([45, 32, 30, 255], (8 * 32 + 16) * 4);
  pixels.set([90, 65, 60, 255], (8 * 32 + 17) * 4);
  const result = recolorPlayerPixels(pixels, 32, { ...appearance, shirt: null }, false);
  assert.deepEqual(Array.from(result.slice((24 * 32 + 16) * 4, (24 * 32 + 16) * 4 + 4)), [48, 112, 128, 120]);
  assert.ok(result[(8 * 32 + 16) * 4] < result[(8 * 32 + 17) * 4]);
});
