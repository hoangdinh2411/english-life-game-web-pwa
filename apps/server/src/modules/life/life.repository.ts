import { ConflictException, Injectable } from '@nestjs/common';
import { GAME_TIME_RATE, lifeStateSchema, type Appearance, type LifeState } from '@life-abroad/shared';
import { PoolClient } from 'pg';

interface LifeRow extends Appearance { clock_time: Date; clock_anchor: Date }

@Injectable()
export class LifeRepository {
  // Character -> stats is the same lock order used by dialogue and quest rewards.
  async lock(client: PoolClient, userId: string): Promise<void> {
    const character = await client.query('SELECT user_id FROM characters WHERE user_id=$1 FOR UPDATE', [userId]);
    if (!character.rowCount) throw new ConflictException('Create a character first');
    await client.query('SELECT user_id FROM player_stats WHERE user_id=$1 FOR UPDATE', [userId]);
    await client.query('INSERT INTO player_life (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [userId]);
    await client.query('UPDATE player_stats SET energy=least(100,coalesce(energy,100)) WHERE user_id=$1', [userId]);
  }

  async state(client: PoolClient, userId: string): Promise<LifeState> {
    const result = await client.query<LifeRow & { energy: number; coins: number }>(
      `SELECT l.clock_time,l.clock_anchor,l.hair,l.shirt,l.trousers,s.energy,s.coins
       FROM player_life l JOIN player_stats s USING (user_id) WHERE user_id=$1`, [userId]);
    const row = result.rows[0];
    if (!row) throw new ConflictException('Create a character first');
    const now = new Date();
    const gameTime = new Date(row.clock_time.getTime() + Math.max(0, now.getTime() - row.clock_anchor.getTime()) * GAME_TIME_RATE);
    const owned = await client.query<{ item_id: string }>('SELECT item_id FROM owned_shirts WHERE user_id=$1 ORDER BY item_id', [userId]);
    return lifeStateSchema.parse({ energy: row.energy, coins: row.coins, gameTime: gameTime.toISOString(),
      serverTime: now.toISOString(), appearance: { hair: row.hair, shirt: row.shirt, trousers: row.trousers },
      ownedShirts: owned.rows.map(item => item.item_id) });
  }

  async replay(client: PoolClient, userId: string, key: string, kind: string, payload: object): Promise<LifeState | undefined> {
    const result = await client.query<{ matches: boolean; response: unknown }>(
      'SELECT kind=$3 AND payload=$4::jsonb AS matches,response FROM player_actions WHERE user_id=$1 AND key=$2',
      [userId, key, kind, JSON.stringify(payload)]);
    const previous = result.rows[0];
    if (!previous) return undefined;
    if (!previous.matches) throw new ConflictException('Action key already used for another operation');
    return lifeStateSchema.parse(previous.response);
  }

  async save(client: PoolClient, userId: string, key: string, kind: string, payload: object): Promise<LifeState> {
    const state = await this.state(client, userId);
    await client.query('INSERT INTO player_actions (user_id,key,kind,payload,response) VALUES ($1,$2,$3,$4,$5)',
      [userId, key, kind, payload, state]);
    return state;
  }
}
