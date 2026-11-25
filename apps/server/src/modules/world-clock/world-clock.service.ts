import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { worldClockSnapshotSchema, type WorldClockSnapshot } from '@life-abroad/shared';
import type { PoolClient, QueryResult } from 'pg';
import { DatabaseService } from '../../infrastructure/database/database.service';

export const SERVER_CLOCK = Symbol('SERVER_CLOCK');

export interface ServerClock { now(): Date }

interface WorldClockRow {
  clock_start_utc: Date | null;
  clock_rate: number | null;
  time_zone: string | null;
  current_map_id?: string | null;
  country_id?: string | null;
}

export interface WorldClockReading {
  gameTimeUtc: Date;
  serverTimeUtc: Date;
  timeZone: string;
  clockRate: number;
  public: WorldClockSnapshot;
}

export interface ZonedGameTime {
  date: string;
  day: 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
  minutes: number;
}

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const AIRPORT_SPAWN_LOCATION_ID = 'loc_airport_departure';
const DEFAULT_AIRPORT_TIME_ZONE = 'UTC';
const DEFAULT_AIRPORT_CLOCK_RATE = 6;

export function zonedGameTime(instant: Date, timeZone: string): ZonedGameTime {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes): string => parts.find(part => part.type === type)?.value ?? '';
  const day = value('weekday').slice(0, 3).toLowerCase() as ZonedGameTime['day'];
  if (!DAYS.includes(day)) throw new ServiceUnavailableException('Country time zone is unavailable.');
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    day,
    minutes: Number(value('hour')) * 60 + Number(value('minute')),
  };
}

@Injectable()
export class WorldClockService {
  constructor(private readonly database: DatabaseService, @Inject(SERVER_CLOCK) private readonly serverClock: ServerClock) {}

  async read(userId: string, client?: PoolClient): Promise<WorldClockReading> {
    const sql = `SELECT w.clock_start_utc,w.clock_rate,co.time_zone,ch.current_map_id,ch.country_id
      FROM public.characters ch
      LEFT JOIN public.worlds w ON w.id=ch.world_id
      LEFT JOIN public.countries co ON co.id=w.country_id
      WHERE ch.user_id=$1`;
    const result: QueryResult<WorldClockRow> = client
      ? await client.query<WorldClockRow>(sql, [userId])
      : await this.database.query<WorldClockRow>(sql, [userId]);
    const row = result.rows[0];
    if (!row) throw new ServiceUnavailableException('World clock is unavailable.');

    const serverTimeUtc = this.serverClock.now();
    if (!row.clock_start_utc || !row.clock_rate || !row.time_zone) {
      if (row.current_map_id === AIRPORT_SPAWN_LOCATION_ID && !row.country_id) {
        const gameTimeUtc = serverTimeUtc;
        const timeZone = DEFAULT_AIRPORT_TIME_ZONE;
        const clockRate = DEFAULT_AIRPORT_CLOCK_RATE;
        const snapshot = worldClockSnapshotSchema.parse({
          gameTimeUtc: gameTimeUtc.toISOString(),
          timeZone,
          clockRate,
        });
        return { gameTimeUtc, serverTimeUtc, timeZone, clockRate, public: snapshot };
      }
      throw new ServiceUnavailableException('World clock is unavailable.');
    }

    const gameTimeUtc = new Date(row.clock_start_utc.getTime() +
      (serverTimeUtc.getTime() - row.clock_start_utc.getTime()) * row.clock_rate);
    const snapshot = worldClockSnapshotSchema.parse({
      gameTimeUtc: gameTimeUtc.toISOString(), timeZone: row.time_zone, clockRate: row.clock_rate,
    });
    return { gameTimeUtc, serverTimeUtc, timeZone: row.time_zone, clockRate: row.clock_rate, public: snapshot };
  }

  async snapshot(userId: string): Promise<WorldClockSnapshot> { return (await this.read(userId)).public; }
}
