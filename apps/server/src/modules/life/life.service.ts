import { BadRequestException, ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { appearanceSchema, canSleep, isVenueOpenAtLocalMinute, restoredEnergy, shopOrderListSchema, venueHoursLabel, type CustomizeRequest, type LifeState, type PurchaseRequest, type Shop, type ShopItem, type VenueKind } from '@life-abroad/shared';
import { PoolClient, type QueryResultRow } from 'pg';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { EconomyService } from '../economy/economy.service';
import { ShopsService } from '../shops/shops.service';
import { LifeRepository } from './life.repository';
import { WorldClockService, zonedGameTime, type WorldClockReading } from '../world-clock/world-clock.service';

interface ShopOrderRow extends QueryResultRow {
  id: string; shop: Shop; items: unknown; total: number; created_at: Date;
}

@Injectable()
export class LifeService {
  constructor(private readonly database: DatabaseService, private readonly repository: LifeRepository,
    private readonly economy: EconomyService, private readonly shops: ShopsService,
    private readonly worldClock: WorldClockService) {}

  get(userId: string): Promise<LifeState> {
    return this.database.transaction(async client => {
      await this.repository.lock(client, userId);
      return this.repository.state(client, userId, await this.worldClock.read(userId, client));
    });
  }

  async venueOpen(client: PoolClient, userId: string, kind: VenueKind): Promise<boolean> {
    return this.isOpen(kind, await this.worldClock.read(userId, client));
  }

  async catalog(): Promise<ShopItem[]> {
    return [...await this.shops.listItems('cafe'), ...await this.shops.listItems('clothes')];
  }

  async recentOrders(userId: string) {
    const result = await this.database.query<ShopOrderRow>(`SELECT id,shop,items,total,created_at
      FROM public.shop_orders WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT 10`, [userId]);
    return shopOrderListSchema.parse(result.rows.map(order => ({ id: order.id, shop: order.shop,
      items: order.items, total: order.total, createdAt: order.created_at.toISOString() })));
  }

  private async recordOrder(client: PoolClient, userId: string, shop: Shop,
    items: Array<{ item: ShopItem; quantity: number }>, idempotencyKey: string): Promise<void> {
    const snapshots = items.map(({ item, quantity }) => ({
      itemId: item.id, name: item.name, quantity, unitPrice: item.price,
    }));
    const total = snapshots.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    await client.query(`INSERT INTO public.shop_orders (user_id,shop,items,total,idempotency_key)
      VALUES ($1,$2,$3::jsonb,$4,$5)`, [userId, shop, JSON.stringify(snapshots), total, idempotencyKey]);
  }

  private action(userId: string, key: string, kind: string, payload: object,
    effect: (client: PoolClient, state: LifeState) => Promise<void>): Promise<LifeState> {
    return this.database.transaction(async client => {
      await this.repository.lock(client, userId);
      const clock = await this.worldClock.read(userId, client);
      const replay = await this.repository.replay(client, userId, key, kind, payload, clock);
      if (replay) return replay;
      await effect(client, await this.repository.state(client, userId, clock));
      return this.repository.save(client, userId, key, kind, payload, clock);
    });
  }

  sleep(userId: string, key: string): Promise<LifeState> {
    return this.action(userId, key, 'sleep', {}, async (client, state) => {
      if (!canSleep(state.energy)) throw new ConflictException('Sleep is available below 50% energy');
      await client.query('UPDATE player_stats SET energy=100,last_energy_update=now() WHERE user_id=$1', [userId]);
    });
  }

  purchase(userId: string, request: PurchaseRequest): Promise<LifeState> {
    const itemIds = [...request.itemIds].sort();
    return this.action(userId, request.key, 'purchase', { itemIds }, async (client, state) => {
      if (!this.isOpen('store', await this.worldClock.read(userId, client))) throw new ConflictException(`Stores open from ${venueHoursLabel('store')}`);
      const result = await client.query<ShopItem>('SELECT id,name,kind,price,shop,color FROM shop_items WHERE id=ANY($1::text[])', [itemIds]);
      const items = result.rows;
      if (items.length !== itemIds.length) throw new BadRequestException('Unknown shop item');
      if (items.length === 2 && !(items.every(item => item.shop === 'cafe') &&
          items.some(item => item.kind === 'drink') && items.some(item => item.kind === 'food'))) {
        throw new BadRequestException('Choose one item or one drink and one food');
      }
      const clothing = items.find(item => item.kind === 'clothing');
      if (clothing && !clothing.color) throw new ServiceUnavailableException('Shirt color is not configured');
      if (clothing && state.ownedShirts.includes(clothing.id)) throw new ConflictException('You already own this shirt');
      const total = items.reduce((sum, item) => sum + item.price, 0);
      await this.economy.spendInTransaction(client, userId, total,
        'shop_purchase', request.key);
      if (items.every(item => item.shop !== 'clothes')) {
        await this.recordOrder(client, userId, items[0]!.shop, items.map(item => ({ item, quantity: 1 })), request.key);
      }
      if (clothing) {
        await client.query('INSERT INTO owned_shirts (user_id,item_id) VALUES ($1,$2)', [userId, clothing.id]);
        await client.query('UPDATE player_life SET shirt=$2 WHERE user_id=$1', [userId, clothing.color]);
      } else {
        await client.query('UPDATE player_stats SET energy=$2,last_energy_update=now() WHERE user_id=$1',
          [userId, restoredEnergy(state.energy, items.map(item => item.kind))]);
      }
    });
  }

  customize(userId: string, request: CustomizeRequest): Promise<LifeState> {
    const { key, ...payload } = request;
    return this.action(userId, key, 'appearance', payload, async (client, state) => {
      let shirt = state.appearance.shirt;
      if (request.shirtItemId) {
        const owned = await client.query<{ color: string | null }>(`SELECT i.color FROM owned_shirts o
          JOIN shop_items i ON i.id=o.item_id WHERE o.user_id=$1 AND o.item_id=$2`, [userId, request.shirtItemId]);
        if (!owned.rows[0]?.color) throw new ConflictException('Buy this shirt before wearing it');
        shirt = appearanceSchema.shape.shirt.parse(owned.rows[0].color);
      }
      await client.query('UPDATE player_life SET hair=$2,trousers=$3,shirt=$4 WHERE user_id=$1',
        [userId, request.hair ?? state.appearance.hair, request.trousers ?? state.appearance.trousers, shirt]);
    });
  }

  async consumeMessage(client: PoolClient, userId: string): Promise<void> {
    await this.repository.lock(client, userId);
    const result = await client.query(`UPDATE player_stats SET energy=energy-1,last_energy_update=now()
      WHERE user_id=$1 AND energy>0 RETURNING energy`, [userId]);
    if (!result.rowCount) throw new ConflictException('You have no energy. Sleep or buy something to eat or drink');
  }

  // The conversation transaction owns payment, consumption, order clearing and receipt.
  async fulfillCafeOrder(client: PoolClient, userId: string, item: ShopItem,
    quantity: number, orderId: string): Promise<boolean> {
    await this.repository.lock(client, userId);
    const clock = await this.worldClock.read(userId, client);
    const state = await this.repository.state(client, userId, clock);
    if (!this.isOpen('store', clock)) throw new ConflictException(`Stores open from ${venueHoursLabel('store')}`);
    const total = item.price * quantity;
    if (state.coins < total) return false;
    await this.economy.spendInTransaction(client, userId, total, 'shop_purchase', `seller_order:${orderId}`, orderId);
    await this.recordOrder(client, userId, item.shop, [{ item, quantity }], orderId);
    const energy = Math.min(100, state.energy + quantity * (item.kind === 'drink' ? 20 : 50));
    await client.query('UPDATE player_stats SET energy=$2,last_energy_update=now() WHERE user_id=$1', [userId, energy]);
    return true;
  }

  async fulfillClothesOrder(client: PoolClient, userId: string, item: ShopItem, orderId: string): Promise<boolean> {
    await this.repository.lock(client, userId);
    const clock = await this.worldClock.read(userId, client);
    const state = await this.repository.state(client, userId, clock);
    if (item.shop !== 'clothes' || item.kind !== 'clothing' || !item.color) {
      throw new BadRequestException('Choose a shirt from the clothes shop');
    }
    if (!this.isOpen('store', clock)) throw new ConflictException(`Stores open from ${venueHoursLabel('store')}`);
    if (state.ownedShirts.includes(item.id)) throw new ConflictException('You already own this shirt');
    if (state.coins < item.price) return false;
    await this.economy.spendInTransaction(client, userId, item.price, 'shop_purchase', `clothes_order:${orderId}`, orderId);
    await client.query('INSERT INTO owned_shirts (user_id,item_id,quantity) VALUES ($1,$2,1)', [userId, item.id]);
    await client.query('UPDATE player_life SET shirt=$2 WHERE user_id=$1', [userId, item.color]);
    return true;
  }

  private isOpen(kind: VenueKind, clock: WorldClockReading): boolean {
    return isVenueOpenAtLocalMinute(kind, zonedGameTime(clock.gameTimeUtc, clock.timeZone).minutes);
  }
}
