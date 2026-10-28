import { ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { isVenueOpenAtLocalMinute, npcPresenceResponseSchema, npcProfileSchema, SHOP_NPC_IDS, TOWN_STREET_NPC_IDS,
  type NpcPresenceResponse, type NpcProfile } from '@life-abroad/shared';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { WorldClockService, zonedGameTime } from '../world-clock/world-clock.service';

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const SHOP_IDS = new Set<string>(SHOP_NPC_IDS);
const STREET_IDS = new Set<string>(TOWN_STREET_NPC_IDS);

interface PresenceRow {
  id: string;
  location_id: string;
  profile: unknown;
}

interface PresenceLocalTime {
  day: typeof DAYS[number];
  minutes: number;
}

function localTime(instant: Date, timeZone: string): PresenceLocalTime {
  const local = zonedGameTime(instant, timeZone);
  return { day: local.day, minutes: local.minutes };
}

function minute(value: string): number {
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}

function slotMatches(slot: NonNullable<NpcProfile['presenceSchedule']>['weeklySlots'][number], local: PresenceLocalTime): boolean {
  const start = minute(slot.start);
  const end = minute(slot.end);
  if (start < end) return slot.days.includes(local.day) && local.minutes >= start && local.minutes < end;
  if (slot.days.includes(local.day) && local.minutes >= start) return true;
  const previous = DAYS[(DAYS.indexOf(local.day) + 6) % 7]!;
  return slot.days.includes(previous) && local.minutes < end;
}

function venueOpen(locationId: string, local: PresenceLocalTime): boolean {
  const kind = locationId === 'loc_cafe' || locationId === 'loc_corner_cafe' ? 'cafe' : 'store';
  return isVenueOpenAtLocalMinute(kind, local.minutes);
}

export function npcIsPresent(row: Pick<PresenceRow, 'id' | 'location_id'> & { profile: NpcProfile }, mapId: string,
  local: PresenceLocalTime): boolean {
  if (row.location_id !== mapId) return false;
  const schedule = row.profile.presenceSchedule;
  if (schedule) {
    const authored = schedule.weeklySlots.some(slot => slot.locationId === mapId && slotMatches(slot, local));
    return authored && (!SHOP_IDS.has(row.id) || venueOpen(row.location_id, local));
  }
  if (STREET_IDS.has(row.id)) return false;
  if (SHOP_IDS.has(row.id)) return venueOpen(row.location_id, local);
  return true;
}

function presentIds(rows: Array<PresenceRow & { profile: NpcProfile }>, mapId: string, instant: Date, timeZone: string): string[] {
  const local = localTime(instant, timeZone);
  return rows.filter(row => npcIsPresent(row, mapId, local)).map(row => row.id).sort();
}

function sameIds(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

export function nextPresenceChange(rows: Array<PresenceRow & { profile: NpcProfile }>, mapId: string,
  gameTime: Date, timeZone: string): Date | null {
  const relevant = rows.filter(row => row.location_id === mapId &&
    (row.profile.presenceSchedule !== undefined || SHOP_IDS.has(row.id) || STREET_IDS.has(row.id)));
  if (!relevant.length) return null;
  const current = presentIds(relevant, mapId, gameTime, timeZone);
  const cursor = new Date(gameTime);
  cursor.setUTCSeconds(0, 0);
  for (let offset = 1; offset <= 8 * 24 * 60; offset++) {
    const candidate = new Date(cursor.getTime() + offset * 60_000);
    if (!sameIds(current, presentIds(relevant, mapId, candidate, timeZone))) return candidate;
  }
  return null;
}

@Injectable()
export class NpcPresenceService {
  constructor(private readonly database: DatabaseService, private readonly worldClock: WorldClockService) {}

  forMap(userId: string, mapId: string): Promise<NpcPresenceResponse> {
    return this.database.transaction(client => this.resolve(client, userId, mapId));
  }

  async assertCanStart(client: PoolClient, userId: string, npcId: string): Promise<void> {
    const result = await this.context(client, npcId);
    const row = result.rows[0];
    if (!row) throw new ConflictException('NPC is not here right now');
    const clock = await this.worldClock.read(userId, client);
    const parsed = { ...row, profile: npcProfileSchema.parse(row.profile) };
    if (!npcIsPresent(parsed, row.location_id, localTime(clock.gameTimeUtc, clock.timeZone))) {
      throw new ConflictException('NPC is not here right now');
    }
  }

  private async resolve(client: PoolClient, userId: string, mapId: string): Promise<NpcPresenceResponse> {
    const result = await this.context(client);
    const first = result.rows[0];
    if (!first) throw new ServiceUnavailableException('NPC presence is unavailable.');
    const clock = await this.worldClock.read(userId, client);
    const gameTime = clock.gameTimeUtc;
    const rows = result.rows.map(row => ({ ...row, profile: npcProfileSchema.parse(row.profile) }));
    const ids = presentIds(rows, mapId, gameTime, clock.timeZone);
    const next = nextPresenceChange(rows, mapId, gameTime, clock.timeZone);
    return npcPresenceResponseSchema.parse({ mapId, gameTime: gameTime.toISOString(), timeZone: clock.timeZone,
      presentNpcIds: ids, nextChangeAt: next?.toISOString() ?? null });
  }

  private async context(client: PoolClient, npcId?: string) {
    return client.query<PresenceRow>(`SELECT n.id,n.location_id,n.profile FROM public.npcs n
      WHERE ($1::text IS NULL OR n.id=$1)`, [npcId ?? null]);
  }
}
