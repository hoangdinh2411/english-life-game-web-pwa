import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module';

test('health remains public, player APIs require auth and legacy auth routes remain absent', async () => {
  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix('api/v1');
  try {
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    const health = await fetch(base + '/api/v1/health');
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok' });
    for (const endpoint of ['me']) {
      assert.equal((await fetch(base + '/api/v1/' + endpoint)).status, 401);
    }
    assert.equal((await fetch(base + '/api/v1/auth/login', { method: 'POST' })).status, 404);
    assert.equal((await fetch(base + '/api/v1/characters', { method: 'POST' })).status, 401);
  } finally { await app.close(); }
});
