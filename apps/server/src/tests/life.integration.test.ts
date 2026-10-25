import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import { lifeStateSchema, shopCatalogSchema } from '@life-abroad/shared';
import { AppModule } from '../app.module';
import { WorldClockService } from '../modules/world-clock/world-clock.service';
import { MutableWorldClock } from './support/mutable-world-clock';

test('life HTTP persists energy/time/outfit and atomically replays purchases, sleep and dialogue', async () => {
  const url = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '54322');
  const database = new Pool({ connectionString: url.toString() });
  const auth = createClient(process.env.SUPABASE_URL ?? '', process.env.SUPABASE_PUBLISHABLE_KEY ?? '', {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const worldClock = new MutableWorldClock();
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(WorldClockService).useValue(worldClock).compile();
  const app = module.createNestApplication(); app.setGlobalPrefix('api/v1');
  let userId: string | undefined;
  try {
    await app.listen(0, '127.0.0.1');
    const signup = await auth.auth.signUp({ email: `life-${randomUUID()}@example.com`, password: randomUUID() });
    assert.equal(signup.error, null); assert.ok(signup.data.session); assert.ok(signup.data.user);
    userId = signup.data.user.id;
    const base = await app.getUrl() + '/api/v1';
    const headers = { Authorization: `Bearer ${signup.data.session.access_token}`, 'Content-Type': 'application/json' };
    const call = (path: string, body?: unknown) => fetch(base + path, { headers,
      method: body === undefined ? 'GET' : 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    assert.equal((await call('/life')).status, 409);
    const options = await (await call('/onboarding/options')).json() as { countries: { id: string }[] };
    assert.equal((await call('/characters', { name: 'Life learner', countryId: options.countries[0]!.id, gender: 'male' })).status, 201);
    const getState = async () => {
      const response = await call('/life'); assert.equal(response.status, 200);
      return lifeStateSchema.parse(await response.json());
    };
    assert.equal((await getState()).energy, 100);
    assert.equal((await getState()).coins, 500);
    const catalog = shopCatalogSchema.parse(await (await call('/life/catalog')).json());
    assert.equal(catalog.length, 14);
    assert.deepEqual(catalog.find(item => item.id === 'shirt_red'),
      { id: 'shirt_red', name: 'Red Shirt', kind: 'clothing', price: 30, shop: 'clothes', color: 'red' });
    const purchase = { key: randomUUID(), itemIds: ['espresso', 'cookie'] };
    await database.query('UPDATE player_stats SET energy=0 WHERE user_id=$1', [userId]);
    const charged = await call('/life/purchase', purchase); assert.equal(charged.status, 201);
    const receipt = lifeStateSchema.parse(await charged.json());
    assert.equal(receipt.energy, 80); assert.equal(receipt.coins, 493);
    assert.deepEqual(await (await call('/life/purchase', purchase)).json(), receipt);
    assert.equal((await call('/life/purchase', { ...purchase, itemIds: ['espresso'] })).status, 409);
    for (const energy of [30, 100]) {
      await database.query('UPDATE player_stats SET energy=$2 WHERE user_id=$1', [userId, energy]);
      const before = await getState();
      assert.equal((await call('/life/sleep', { key: randomUUID() })).status, 409);
      assert.equal((await getState()).energy, energy);
      assert.ok(Math.abs(Date.parse((await getState()).gameTime) - Date.parse(before.gameTime)) < 5000);
    }
    await database.query('UPDATE player_stats SET energy=29 WHERE user_id=$1', [userId]);
    const clock = (await getState()).gameTime;
    const sleep = { key: randomUUID() };
    const sleeps = await Promise.all([call('/life/sleep', sleep), call('/life/sleep', sleep)]);
    const rested = lifeStateSchema.parse(await sleeps[0]!.json());
    assert.deepEqual(await sleeps[1]!.json(), rested); assert.equal(rested.energy, 79);
    assert.ok(Math.abs(Date.parse(rested.gameTime) - Date.parse(clock)) < 5000);
    // Cached receipts remain replayable even if the shop has since closed.
    worldClock.setGameTime('2000-01-01T20:00:00.000Z');
    assert.equal((await call('/life/purchase', { key: randomUUID(), itemIds: ['espresso'] })).status, 409);
    const replayAtCurrentTime = lifeStateSchema.parse(await (await call('/life/purchase', purchase)).json());
    assert.deepEqual({ ...replayAtCurrentTime, gameTime: receipt.gameTime }, receipt);
    assert.equal(replayAtCurrentTime.gameTime, '2000-01-01T20:00:00.000Z');
    worldClock.setGameTime('2000-01-01T08:00:00.000Z');
    await database.query('UPDATE player_stats SET coins=5,energy=0 WHERE user_id=$1', [userId]);
    const competing = await Promise.all([call('/life/purchase', { key: randomUUID(), itemIds: ['espresso'] }),
      call('/life/purchase', { key: randomUUID(), itemIds: ['espresso'] })]);
    assert.deepEqual(competing.map(response => response.status).sort(), [201, 409]);
    assert.equal((await getState()).coins, 0); assert.equal((await getState()).energy, 20);
    assert.equal((await database.query<{ count: number }>('SELECT count(*)::int AS count FROM wallet_ledger WHERE user_id=$1 AND reason=$2',
      [userId, 'shop_purchase'])).rows[0]?.count, 2, 'Rejected/replayed purchases add no extra wallet entries');
    await database.query('UPDATE player_stats SET coins=500 WHERE user_id=$1', [userId]);
    assert.equal((await call('/life/purchase', { key: randomUUID(), itemIds: ['shirt_blue'] })).status, 201);
    const dressed = await getState();
    assert.deepEqual(dressed.ownedShirts, ['shirt_blue']); assert.equal(dressed.appearance.shirt, 'blue');
    assert.equal(dressed.energy, 20); assert.equal(dressed.coins, 470);
    assert.equal((await call('/life/appearance', { key: randomUUID(), shirtItemId: 'shirt_red' })).status, 409);
    assert.equal((await call('/life/appearance', { key: randomUUID(), hair: 'blond', trousers: 'charcoal' })).status, 201);
    assert.deepEqual((await getState()).appearance, { hair: 'blond', shirt: 'blue', trousers: 'charcoal' });
    for (const table of ['player_life', 'owned_shirts', 'player_actions']) {
      const connection = await database.connect();
      try {
        await connection.query('BEGIN'); await connection.query('SET LOCAL ROLE authenticated');
        await assert.rejects(connection.query(`SELECT * FROM public.${table}`), { code: '42501' });
      } finally { await connection.query('ROLLBACK'); connection.release(); }
    }
    assert.equal((await call('/life/purchase', { key: randomUUID(), itemIds: ['espresso'], coins: 999 })).status, 400);
    assert.equal((await call('/life/purchase', { key: randomUUID(), itemIds: ['missing_item'] })).status, 400);
    assert.equal((await call('/life/sleep', { key: randomUUID(), energy: 100 })).status, 400);
    // Message replay cannot consume another energy point; failures must commit nothing.
    const conversation = await (await call('/conversations', { npcId: 'npc_receptionist' })).json() as { id: string };
    await database.query('UPDATE player_stats SET energy=1 WHERE user_id=$1', [userId]);
    const message = { clientMessageId: randomUUID(), text: 'Hello!' };
    const route = `/conversations/${conversation.id}/messages`;
    assert.equal((await call(route, message)).status, 201); assert.equal((await getState()).energy, 0);
    assert.equal((await call(route, message)).status, 201); assert.equal((await getState()).energy, 0);
    assert.equal((await call(route, { clientMessageId: randomUUID(), text: 'Hello again' })).status, 409);
    assert.equal((await getState()).energy, 0);
    assert.equal((await fetch(base + '/life')).status, 401);
    assert.deepEqual((await getState()).appearance, { hair: 'blond', shirt: 'blue', trousers: 'charcoal' });
  } finally {
    if (userId) await database.query('DELETE FROM auth.users WHERE id=$1', [userId]);
    await app.close(); await database.end();
  }
});

