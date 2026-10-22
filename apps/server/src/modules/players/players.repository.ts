import { ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type {
  CountryCatalogEntry,
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
  name: string | null; current_city_id: string | null; country_id: string | null; outfit: unknown;
  current_map_id: string | null; current_place_id: string | null;
  current_position_x: number | null; current_position_y: number | null;
  xp: number | null; coins: number | null;
}

interface PlayerPreferencesRow {
  coach_enabled: boolean;
  speech_rate: number;
  speech_pitch: number;
  updated_at: Date | string;
}

function mapPreferences(row: PlayerPreferencesRow): PlayerPreferences {
  return {
    coachEnabled: row.coach_enabled,
    speechRate: row.speech_rate,
    speechPitch: row.speech_pitch,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : new Date(row.updated_at).toISOString(),
  };
}

@Injectable()
export class PlayersRepository {
  constructor(private readonly database: DatabaseService, private readonly economy: EconomyService) {}

  async createCharacter(userId: string, request: CreateCharacterRequest, country: CountryCatalogEntry): Promise<PlayerState> {
    return this.database.transaction(async client => {
      // Serialize creation and grant the starter money in the same transaction.
      const profile = await client.query('SELECT id FROM public.profiles WHERE id = $1 FOR UPDATE', [userId]);
      if (profile.rowCount !== 1) throw new ServiceUnavailableException('Player profile is unavailable');
      const before = await this.getPlayer(userId, client);
      if (before.character) throw new ConflictException('A character already exists');
      await client.query(`INSERT INTO public.characters
        (user_id, name, outfit, country_id, current_city_id, current_map_id, current_place_id, current_position_x, current_position_y)
        VALUES ($1, $2, $3, $4, $5, 'loc_station', 'loc_station', 768, 370)`,
        [userId, request.name, JSON.stringify({ avatarId: request.avatarId }), country.id, country.starterCityId]);
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
      `SELECT coach_enabled, speech_rate, speech_pitch, updated_at
       FROM public.player_preferences WHERE user_id = $1`,
      [userId],
    );
    return { preferences: result.rows[0] ? mapPreferences(result.rows[0]) : null };
  }

  async initializePreferences(userId: string, preferences: PlayerPreferencesInitialize): Promise<PlayerPreferences> {
    return this.database.transaction(async client => {
      await client.query(
        `INSERT INTO public.player_preferences (user_id, coach_enabled, speech_rate, speech_pitch)
         VALUES ($1, $2, $3, $4) ON CONFLICT (user_id) DO NOTHING`,
        [userId, preferences.coachEnabled, preferences.speechRate, preferences.speechPitch],
      );
      const result = await client.query<PlayerPreferencesRow>(
        `SELECT coach_enabled, speech_rate, speech_pitch, updated_at
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
      `INSERT INTO public.player_preferences (user_id, coach_enabled, speech_rate, speech_pitch)
       VALUES ($1, COALESCE($2::boolean, false), COALESCE($3::real, 1), COALESCE($4::real, 1))
       ON CONFLICT (user_id) DO UPDATE SET
         coach_enabled = COALESCE($2::boolean, player_preferences.coach_enabled),
         speech_rate = COALESCE($3::real, player_preferences.speech_rate),
         speech_pitch = COALESCE($4::real, player_preferences.speech_pitch),
         updated_at = now()
       RETURNING coach_enabled, speech_rate, speech_pitch, updated_at`,
      [userId, preferences.coachEnabled ?? null, preferences.speechRate ?? null, preferences.speechPitch ?? null],
    );
    const row = result.rows[0];
    if (!row) throw new ServiceUnavailableException('Player preferences are unavailable');
    return mapPreferences(row);
  }

  async getPlayer(userId: string, client?: PoolClient): Promise<PlayerResponse> {
    const sql = `
      SELECT p.id, u.email, p.display_name, c.name, c.current_city_id, c.country_id, c.current_map_id, c.current_place_id,
        c.current_position_x, c.current_position_y, c.outfit, s.xp, s.coins
      FROM public.profiles p JOIN auth.users u ON u.id = p.id
      LEFT JOIN public.characters c ON c.user_id = p.id
      LEFT JOIN public.player_stats s ON s.user_id = p.id WHERE p.id = $1`;
    const result = client ? await client.query<PlayerRow>(sql, [userId]) : await this.database.query<PlayerRow>(sql, [userId]);
    const row = result.rows[0];
    if (!row || row.xp === null || row.coins === null) throw new ServiceUnavailableException('Player state is unavailable');
    const outfit = row.outfit;
    const avatarId = typeof outfit === 'object' && outfit !== null && 'avatarId' in outfit && typeof outfit.avatarId === 'string' ? outfit.avatarId : null;
    if (row.name !== null && (!row.current_city_id || !row.country_id || !row.current_map_id || !row.current_place_id || row.current_position_x === null || row.current_position_y === null || !avatarId)) throw new ServiceUnavailableException('Character state is unavailable');
    return {
      user: { id: row.id, email: row.email, displayName: row.display_name },
      character: row.name === null ? null : { id: row.id, userId: row.id, name: row.name, cityId: row.current_city_id!, countryId: row.country_id!, avatarId: avatarId!,
        lastLocation: { mapId: row.current_map_id as PlayerLocation['mapId'], placeId: row.current_place_id as PlayerLocation['placeId'],
          x: row.current_position_x!, y: row.current_position_y! } },
      stats: { xp: row.xp, coins: row.coins },
    };
  }
}
