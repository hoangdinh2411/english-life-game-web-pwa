import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
test('Vite and React DOM resolve alongside shared contracts in the game workspace', () => {
  assert.ok(require.resolve('vite'));
  assert.ok(require.resolve('react-dom/client'));
  assert.equal(require('@life-abroad/shared').API_PREFIX, 'api/v1');
  const entry = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(entry, /src="\/src\/main.tsx"/);
});
