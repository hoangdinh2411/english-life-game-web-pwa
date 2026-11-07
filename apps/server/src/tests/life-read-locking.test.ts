import assert from 'node:assert/strict';
import test from 'node:test';
import type { PoolClient } from 'pg';
import type { DatabaseService } from '../infrastructure/database/database.service';
import type { EconomyService } from '../modules/economy/economy.service';
import type { LifeRepository } from '../modules/life/life.repository';
import { LifeService } from '../modules/life/life.service';
import type { ShopsService } from '../modules/shops/shops.service';
import type { WorldClockService } from '../modules/world-clock/world-clock.service';

test('loading life state is read-only and does not take gameplay row locks', async () => {
  const client = {} as PoolClient;
  const database = { transaction: <T>(work: (connection: PoolClient) => Promise<T>) => work(client) } as DatabaseService;
  let locked = false;
  const repository = {
    lock: async () => { locked = true; },
    state: async () => ({ energy: 80, coins: 10, gameTime: '2026-11-06T20:00:00.000Z', clockRate: 4,
      serverTime: '2026-11-06T20:00:00.000Z', appearance: { hair: '#111111', shirt: '#222222', trousers: '#333333' },
      ownedShirts: [] }),
  } as unknown as LifeRepository;
  const worldClock = { read: async () => ({ gameTimeUtc: new Date('2026-11-06T20:00:00.000Z'),
    serverTimeUtc: new Date('2026-11-06T20:00:00.000Z'), timeZone: 'Europe/Stockholm', clockRate: 4, public: {} }) } as unknown as WorldClockService;
  const service = new LifeService(database, repository, {} as EconomyService, {} as ShopsService, worldClock);

  const state = await service.get('user-1');
  assert.equal(locked, false);
  assert.equal(state.energy, 80);
});
