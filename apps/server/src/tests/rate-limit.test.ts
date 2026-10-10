import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';

test('fixed windows isolate peers, reset at expiry and do not extend on rejection', () => {
  const guard = new RateLimitGuard(new ConfigService({ API_RATE_LIMIT_MAX: '2', API_RATE_LIMIT_WINDOW_MS: '1000' }));
  try {
    assert.equal(guard.consume('peer-one', 100), 0);
    assert.equal(guard.consume('peer-one', 200), 0);
    assert.equal(guard.consume('peer-one', 300), 1);
    assert.equal(guard.consume('peer-two', 300), 0);
    assert.equal(guard.consume('peer-one', 1099), 1);
    assert.equal(guard.consume('peer-one', 1100), 0);
  } finally { guard.onModuleDestroy(); }
});

test('no implicit cap; partial, zero, fractional and invalid configuration fails startup', () => {
  const disabled = new RateLimitGuard(new ConfigService({}));
  for (let i = 0; i < 100; i++) assert.equal(disabled.consume('peer', 0), 0);
  disabled.onModuleDestroy();
  for (const settings of [
    { API_RATE_LIMIT_MAX: '2' }, { API_RATE_LIMIT_WINDOW_MS: '1000' },
    { API_RATE_LIMIT_MAX: '0', API_RATE_LIMIT_WINDOW_MS: '1000' },
    { API_RATE_LIMIT_MAX: '1.5', API_RATE_LIMIT_WINDOW_MS: '1000' },
    { API_RATE_LIMIT_MAX: 'two', API_RATE_LIMIT_WINDOW_MS: '1000' },
    { API_RATE_LIMIT_MAX: '2', API_RATE_LIMIT_WINDOW_MS: '2147483648' },
  ]) assert.throws(() => new RateLimitGuard(new ConfigService(settings)), /must both be positive integers/);
});

test('API allows calls up to the configured limit and rejects concurrent excess before auth', async () => {
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ConfigService).useValue(new ConfigService({
      API_RATE_LIMIT_MAX: '2', API_RATE_LIMIT_WINDOW_MS: '60000',
    })).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix('api/v1');
  try {
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    const first = await fetch(base + '/api/v1/health');
    assert.equal(first.status, 200);
    assert.deepEqual(await first.json(), { status: 'ok' });
    // Failed authentication counts too, without changing the existing auth boundary.
    assert.equal((await fetch(base + '/api/v1/me')).status, 401);
    const rejected = await Promise.all(Array.from({ length: 4 }, (_, i) => fetch(base + '/api/v1/characters', {
      method: 'POST', headers: { 'X-Forwarded-For': `192.0.2.${i}`, Authorization: `Bearer fixture-${i}` },
    })));
    for (const response of rejected) {
      assert.equal(response.status, 429);
      assert.ok(Number(response.headers.get('retry-after')) > 0);
      assert.deepEqual(await response.json(), { error: { code: 'too_many_requests', message: 'Too many requests' } });
    }
  } finally { await app.close(); }
});
