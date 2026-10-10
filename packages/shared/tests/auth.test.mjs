import assert from 'node:assert/strict';
import test from 'node:test';
import { credentialsSchema, registrationSchema, refreshSessionSchema } from '../dist/index.js';

test('auth contracts normalize email and preserve the submitted display name', () => {
  assert.deepEqual(registrationSchema.parse({ email: ' User@Example.com ', password: 'password123', displayName: ' Player ' }),
    { email: 'user@example.com', password: 'password123', displayName: ' Player ' });
});

test('auth contracts reject unknown fields, missing registration names and invalid refresh payloads', () => {
  assert.equal(credentialsSchema.safeParse({ email: 'user@example.com', password: 'password123', coins: 999 }).success, false);
  assert.equal(registrationSchema.safeParse({ email: 'user@example.com', password: 'password123' }).success, false);
  assert.equal(refreshSessionSchema.safeParse({ refreshToken: '' }).success, false);
  assert.equal(refreshSessionSchema.safeParse({ refreshToken: 'valid', subject: 'another-user' }).success, false);
});
