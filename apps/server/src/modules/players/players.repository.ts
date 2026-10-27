import { BadRequestException, ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type {
  CreateCharacterRequest,
  PlayerLocation,
  PlayerPreferences,
  PlayerPreferencesInitialize,
  PlayerPreferencesRead,
  PlayerPreferencesUpdate,
  PlayerResponse,
  PlayerState,
} from '@life-abroad/shared';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { EconomyService } from '../economy/economy.service';

interface PlayerRow {
  id: string; email: string; display_name: string;
  name: string | null; gender: 'female' | 'male' | null; current_city_id: string | null; country_id: string | null; country_name: string | null; outfit: unknown;
  current_map_id: string | null; current_place_id: string | null;
  current_position_x: number | null; current_position_y: number | null;
  xp: number | null; coins: number | null;
}

interface PlayerPreferencesRow {
  speech_rate: number;
  speech_pitch: number;
  updated_at: Date | string;
}

interface StarterCountryRow {
  id: string;
  starter_city_id: string;
  starter_location_id: string;
}

function mapPreferences(row: PlayerPreferencesRow): PlayerPreferences {
  return {
    speechRate: row.speech_rate,
    speechPitch: row.speech_pitch,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : new Date(row.updated_at).toISOString(),
  };
}

@Injectable()
export class PlayersRepository {
  constructor(private readonly database: DatabaseService, private readonly economy: EconomyService) {}

  async createCharacter(userId: string, request: CreateCharacterRequest): Promise<PlayerState> {
    return this.database.transaction(async client => {
      // Serialize creation and grant the starter money in the same transaction.
      const profile = await client.query('SELECT id FROM public.profiles WHERE id = $1 FOR UPDATE', [userId]);
      if (profile.rowCount !== 1) throw new ServiceUnavailableException('Player profile is unavailable');
      const countryResult = await client.query<StarterCountryRow>(`SELECT id,starter_city_id,starter_location_id
        FROM public.countries WHERE id=$1`, [request.countryId]);
      const country = countryResult.rows[0];
      if (!country) throw new BadRequestException('Unknown country');
      const before = await this.getPlayer(userId, client);
      if (before.character) {
        if (before.character.name !== request.name || before.character.countryId !== request.countryId || before.character.gender !== request.gender) {
          throw new ConflictException('A different character already exists');
        }
        return { ...before, character: before.character, inventory: [], questProgress: [] };
      }
      const world = await client.query<{ id: string }>(`INSERT INTO public.worlds (country_id) VALUES ($1)
        ON CONFLICT (country_id) DO UPDATE SET country_id=excluded.country_id RETURNING id`, [country.id]);
      const worldId = world.rows[0]?.id;
      if (!worldId) throw new ServiceUnavailableException('Country world is unavailable');
      await client.query(`INSERT INTO public.characters
        (user_id, name, gender, outfit, country_id, world_id, current_city_id, current_map_id, current_place_id, current_position_x, current_position_y)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, 768, 370)
        ON CONFLICT (user_id) DO UPDATE SET
          name=excluded.name, gender=excluded.gender, outfit=excluded.outfit, country_id=excluded.country_id, world_id=excluded.world_id,
          current_city_id=excluded.current_city_id, current_map_id=excluded.current_map_id,
          current_place_id=excluded.current_place_id, current_position_x=excluded.current_position_x,
          current_position_y=excluded.current_position_y
        WHERE characters.country_id IS NULL OR characters.current_city_id IS NULL`,
        [userId, request.name, request.gender, JSON.stringify({ avatarId: 'avatar_traveler_01' }), country.id, worldId,
          country.starter_city_id, country.starter_location_id]);
      await this.economy.grantStartingBalance(client, userId);
      const player = await this.getPlayer(userId, client);
      if (!player.character) throw new ServiceUnavailableException('Character state is unavailable');
      return { ...player, character: player.character, inventory: [], questProgress: [] };
    });
  }

  async saveLocation(userId: string, location: PlayerLocation): Promise<PlayerLocation> {
    const result = await this.database.query(
      `UPDATE public.characters SET current_map_id=$2, current_place_id=$3, current_position_x=$4, current_position_y=$5
       WHERE user_id=$1 RETURNING current_map_id, current_place_id, current_position_x, current_position_y`,
      [userId, location.mapId, location.placeId, location.x, location.y],
    );
    if (result.rowCount !== 1) throw new ServiceUnavailableException('Character state is unavailable');
    return location;
  }

  async getPreferences(userId: string): Promise<PlayerPreferencesRead> {
    const result = await this.database.query<PlayerPreferencesRow>(
      `SELECT speech_rate, speech_pitch, updated_at
       FROM public.player_preferences WHERE user_id = $1`,
      [userId],
    );
    return { preferences: result.rows[0] ? mapPreferences(result.rows[0]) : null };
  }

  async initializePreferences(userId: string, preferences: PlayerPreferencesInitialize): Promise<PlayerPreferences> {
    return this.database.transaction(async client => {
      await client.query(
        `INSERT INTO public.player_preferences (user_id, speech_rate, speech_pitch)
         VALUES ($1, $2, $3) ON CONFLICT (user_id) DO NOTHING`,
        [userId, preferences.speechRate, preferences.speechPitch],
      );
      const result = await client.query<PlayerPreferencesRow>(
        `SELECT speech_rate, speech_pitch, updated_at
         FROM public.player_preferences WHERE user_id = $1`,
        [userId],
      );
      const row = result.rows[0];
      if (!row) throw new ServiceUnavailableException('Player preferences are unavailable');
      return mapPreferences(row);
    });
  }

  async updatePreferences(userId: string, preferences: PlayerPreferencesUpdate): Promise<PlayerPreferences> {
    const result = await this.database.query<PlayerPreferencesRow>(
      `INSERT INTO public.player_preferences (user_id, speech_rate, speech_pitch)
       VALUES ($1, COALESCE($2::real, 1), COALESCE($3::real, 1))
       ON CONFLICT (user_id) DO UPDATE SET
         speech_rate = COALESCE($2::real, player_preferences.speech_rate),
         speech_pitch = COALESCE($3::real, player_preferences.speech_pitch),
         updated_at = now()
       RETURNING speech_rate, speech_pitch, updated_at`,
      [userId, preferences.speechRate ?? null, preferences.speechPitch ?? null],
    );
    const row = result.rows[0];
    if (!row) throw new ServiceUnavailableException('Player preferences are unavailable');
    return mapPreferences(row);
  }

  async getPlayer(userId: string, client?: PoolClient): Promise<PlayerResponse> {
    const sql = `
      SELECT p.id, u.email, p.display_name, c.name, c.gender, c.current_city_id, c.country_id, co.name AS country_name,
        c.current_map_id, c.current_place_id,
        c.current_position_x, c.current_position_y, c.outfit, s.xp, s.coins
      FROM public.profiles p JOIN auth.users u ON u.id = p.id
      LEFT JOIN public.characters c ON c.user_id = p.id
      LEFT JOIN public.countries co ON co.id = c.country_id
      LEFT JOIN public.player_stats s ON s.user_id = p.id WHERE p.id = $1`;
    const result = client ? await client.query<PlayerRow>(sql, [userId]) : await this.database.query<PlayerRow>(sql, [userId]);
    const row = result.rows[0];
    if (!row || row.xp === null || row.coins === null) throw new ServiceUnavailableException('Player state is unavailable');
    const outfit = row.outfit;
    const avatarId = typeof outfit === 'object' && outfit !== null && 'avatarId' in outfit && typeof outfit.avatarId === 'string' ? outfit.avatarId : null;
    const needsOnboarding = row.name !== null && (!row.current_city_id || !row.country_id || !row.country_name);
    if (row.name !== null && !needsOnboarding && (!row.current_map_id || !row.current_place_id || row.current_position_x === null || row.current_position_y === null || !avatarId)) throw new ServiceUnavailableException('Character state is unavailable');
    return {
      user: { id: row.id, email: row.email, displayName: row.display_name },
      character: row.name === null || needsOnboarding ? null : { id: row.id, userId: row.id, name: row.name, gender: row.gender!, cityId: row.current_city_id!, countryId: row.country_id!, countryName: row.country_name!, avatarId: avatarId!,
        lastLocation: { mapId: row.current_map_id as PlayerLocation['mapId'], placeId: row.current_place_id as PlayerLocation['placeId'],
          x: row.current_position_x!, y: row.current_position_y! } },
      stats: { xp: row.xp, coins: row.coins },
    };
  }
}
