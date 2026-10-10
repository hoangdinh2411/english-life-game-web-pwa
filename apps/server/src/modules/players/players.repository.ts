import { ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { CreateCharacterRequest, PlayerResponse, PlayerState, StarterCity } from '@life-abroad/shared';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../infrastructure/database/database.service';

interface PlayerRow {
  id: string; email: string; display_name: string;
  name: string | null; current_city_id: string | null; outfit: unknown;
  xp: number | null; coins: number | null;
}

@Injectable()
export class PlayersRepository {
  constructor(private readonly database: DatabaseService) {}

  async createCharacter(userId: string, request: CreateCharacterRequest, city: StarterCity): Promise<PlayerState> {
    return this.database.transaction(async client => {
      // Serialize attempts for this account. Stats are read, never initialized or reset here.
      const profile = await client.query('SELECT id FROM public.profiles WHERE id = $1 FOR UPDATE', [userId]);
      if (profile.rowCount !== 1) throw new ServiceUnavailableException('Player profile is unavailable');
      const before = await this.getPlayer(userId, client);
      if (before.character) throw new ConflictException('A character already exists');
      // Materialize only the validated selected city for the existing foreign key.
      // Full world/dialogue seeding remains T2; never overwrite existing city data.
      await client.query('INSERT INTO public.cities (id, name, description) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
        [city.id, city.name, city.description ?? null]);
      await client.query('INSERT INTO public.characters (user_id, name, outfit, current_city_id) VALUES ($1, $2, $3, $4)',
        [userId, request.name, JSON.stringify({ avatarId: request.avatarId }), request.cityId]);
      const player = await this.getPlayer(userId, client);
      if (!player.character) throw new ServiceUnavailableException('Character state is unavailable');
      return { ...player, character: player.character, inventory: [], questProgress: [] };
    });
  }

  async getPlayer(userId: string, client?: PoolClient): Promise<PlayerResponse> {
    const sql = `
      SELECT p.id, u.email, p.display_name, c.name, c.current_city_id, c.outfit, s.xp, s.coins
      FROM public.profiles p JOIN auth.users u ON u.id = p.id
      LEFT JOIN public.characters c ON c.user_id = p.id
      LEFT JOIN public.player_stats s ON s.user_id = p.id WHERE p.id = $1`;
    const result = client ? await client.query<PlayerRow>(sql, [userId]) : await this.database.query<PlayerRow>(sql, [userId]);
    const row = result.rows[0];
    if (!row || row.xp === null || row.coins === null) throw new ServiceUnavailableException('Player state is unavailable');
    const outfit = row.outfit;
    const avatarId = typeof outfit === 'object' && outfit !== null && 'avatarId' in outfit && typeof outfit.avatarId === 'string' ? outfit.avatarId : null;
    if (row.name !== null && (!row.current_city_id || !avatarId)) throw new ServiceUnavailableException('Character state is unavailable');
    return {
      user: { id: row.id, email: row.email, displayName: row.display_name },
      character: row.name === null ? null : { id: row.id, userId: row.id, name: row.name, cityId: row.current_city_id!, avatarId: avatarId! },
      stats: { xp: row.xp, coins: row.coins },
    };
  }
}
