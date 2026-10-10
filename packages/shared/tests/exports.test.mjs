import assert from 'node:assert/strict';
import test from 'node:test';
import { API_PREFIX } from '../dist/index.js';

test('compiled shared package exports the API prefix', () => {
  assert.equal(API_PREFIX, 'api/v1');
});
