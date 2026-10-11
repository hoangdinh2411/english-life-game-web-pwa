import { BadRequestException, ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { appearanceSchema, canSleep, isVenueOpen, restoredEnergy, SLEEP_HOURS, type CustomizeRequest, type LifeState, type PurchaseRequest, type ShopItem } from '@life-abroad/shared';
import { PoolClient } from 'pg';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { EconomyService } from '../economy/economy.service';
import { ShopsService } from '../shops/shops.service';
import { LifeRepository } from './life.repository';

@Injectable()
export class LifeService {
  constructor(private readonly database: DatabaseService, private readonly repository: LifeRepository,
    private readonly economy: EconomyService, private readonly shops: ShopsService) {}

  get(userId: string): Promise<LifeState> {
    return this.database.transaction(async client => {
      await this.repository.lock(client, userId);
      return this.repository.state(client, userId);
    });
  }

  async catalog(): Promise<ShopItem[]> {
    return [...await this.shops.listItems('cafe'), ...await this.shops.listItems('clothes')];
  }

  private action(userId: string, key: string, kind: string, payload: object,
    effect: (client: PoolClient, state: LifeState) => Promise<void>): Promise<LifeState> {
    return this.database.transaction(async client => {
      await this.repository.lock(client, userId);
      const replay = await this.repository.replay(client, userId, key, kind, payload);
      if (replay) return replay;
      await effect(client, await this.repository.state(client, userId));
      return this.repository.save(client, userId, key, kind, payload);
    });
  }

  sleep(userId: string, key: string): Promise<LifeState> {
    return this.action(userId, key, 'sleep', {}, async (client, state) => {
      if (!canSleep(state.energy)) throw new ConflictException('Sleep is available below 50% energy');
      const advanced = new Date(Date.parse(state.gameTime) + SLEEP_HOURS * 3600000);
      await client.query('UPDATE player_life SET clock_time=$2,clock_anchor=$3 WHERE user_id=$1', [userId, advanced, state.serverTime]);
      await client.query('UPDATE player_stats SET energy=100,last_energy_update=now() WHERE user_id=$1', [userId]);
    });
  }

  purchase(userId: string, request: PurchaseRequest): Promise<LifeState> {
    const itemIds = [...request.itemIds].sort();
    return this.action(userId, request.key, 'purchase', { itemIds }, async (client, state) => {
      if (!isVenueOpen('store', new Date(state.gameTime))) throw new ConflictException('Stores open from 08:00 to 20:00 game time');
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
      await this.economy.spendInTransaction(client, userId, items.reduce((total, item) => total + item.price, 0),
        'shop_purchase', request.key);
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
}
