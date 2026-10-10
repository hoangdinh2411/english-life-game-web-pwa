import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module';
import { AuthGuard } from '../modules/auth/auth.guard';
import { AuthModule } from '../modules/auth/auth.module';
import { CurrentUser } from '../modules/auth/current-user.decorator';

// This controller exists only in tests; R1 adds no player/authentication endpoint.
@Controller('identity-test')
@UseGuards(AuthGuard)
class IdentityController {
  @Get()
  getIdentity(@CurrentUser() userId: string): { id: string } { return { id: userId }; }
}

test('guard verifies tokens with Supabase and exposes only the verified identity', async (t) => {
  const requests: string[] = [];
  const auth = createServer((request, response) => {
    assert.equal(request.url, '/auth/v1/user');
    assert.equal(request.headers.apikey, 'test-publishable-key');
    const token = request.headers.authorization ?? '';
    requests.push(token);
    response.setHeader('Content-Type', 'application/json');
    if (token === 'Bearer valid-one' || token === 'Bearer valid-two') {
      response.end(JSON.stringify({ id: token === 'Bearer valid-one' ? 'user-one' : 'user-two',
        aud: 'authenticated', role: 'authenticated', email: 'fixture@example.com',
        app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }));
    } else if (token === 'Bearer empty-user') {
      response.end('{}');
    } else {
      response.statusCode = 401;
      response.end(JSON.stringify({ code: token === 'Bearer expired' ? 'jwt_expired' : 'bad_jwt',
        message: 'Invalid JWT' }));
    }
  });
  await new Promise<void>((resolve) => auth.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    if (auth.listening) await new Promise<void>((resolve) => auth.close(() => resolve()));
  });
  const address = auth.address();
  assert.ok(address && typeof address !== 'string');
  const module = await Test.createTestingModule({ imports: [AppModule, AuthModule], controllers: [IdentityController] })
    .overrideProvider(ConfigService).useValue(new ConfigService({
      SUPABASE_URL: `http://127.0.0.1:${address.port}`, SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
    })).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix('api/v1');
  try {
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    await t.test('valid tokens yield their own verified identity without shared sessions', async () => {
      for (const [token, id] of [['valid-one', 'user-one'], ['valid-two', 'user-two']]) {
        const result = await fetch(base + '/api/v1/identity-test', { headers: { Authorization: `Bearer ${token}` } });
        assert.equal(result.status, 200);
        assert.deepEqual(await result.json(), { id });
      }
    });
    await t.test('missing and malformed authorization is rejected without calling Auth', async () => {
      const count = requests.length;
      for (const header of [undefined, 'Basic valid-one', 'Bearer', 'Bearer a b', 'Bearer a,b']) {
        const result = await fetch(base + '/api/v1/identity-test', { headers: header ? { Authorization: header } : {} });
        assert.equal(result.status, 401);
        assert.deepEqual(await result.json(), { error: { code: 'unauthorized', message: 'Unauthorized' } });
      }
      assert.equal(requests.length, count);
    });
    await t.test('expired, forged and missing-user tokens fail closed', async () => {
      for (const token of ['expired', 'forged', 'empty-user']) {
        const result = await fetch(base + '/api/v1/identity-test', { headers: { Authorization: `Bearer ${token}` } });
        assert.equal(result.status, 401);
        assert.deepEqual(await result.json(), { error: { code: 'unauthorized', message: 'Unauthorized' } });
      }
    });
    await t.test('health is public and does not call Supabase', async () => {
      const count = requests.length;
      const result = await fetch(base + '/api/v1/health', { headers: { Authorization: 'Bearer expired' } });
      assert.equal(result.status, 200);
      assert.deepEqual(await result.json(), { status: 'ok' });
      assert.equal(requests.length, count);
    });
    await t.test('unavailable Supabase never authenticates a caller', async () => {
      await new Promise<void>((resolve, reject) => auth.close((error) => error ? reject(error) : resolve()));
      const result = await fetch(base + '/api/v1/identity-test', { headers: { Authorization: 'Bearer valid-one' } });
      assert.equal(result.status, 401);
      assert.deepEqual(await result.json(), { error: { code: 'unauthorized', message: 'Unauthorized' } });
    });
  } finally {
    await app.close();
    if (auth.listening) await new Promise<void>((resolve) => auth.close(() => resolve()));
  }
});
