import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { moodIdSchema, npcProfileSchema, type MoodId, type NpcProfile } from '@life-abroad/shared';
import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { WorldClockService, zonedGameTime } from '../world-clock/world-clock.service';

export interface LocalGameTime {
  date: string;
  minutes: number;
}

export interface NpcMoodContext {
  id: MoodId;
  label: string;
  guidance: string;
}

interface MoodContextRow {
  profile: unknown;
  current_mood_id: string;
}

function minute(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours! * 60 + minutes!;
}

function inWindow(now: number, start: number, end: number): boolean {
  return start < end ? now >= start && now < end : now >= start || now < end;
}

export function localGameTime(instant: Date, timeZone: string): LocalGameTime {
  const local = zonedGameTime(instant, timeZone);
  return { date: local.date, minutes: local.minutes };
}

function selected(seed: string, chancePercent: number): boolean {
  const value = createHash('sha256').update(seed).digest().readUInt32BE(0) % 100;
  return value < chancePercent;
}

export function resolveBaseNpcMood(npcId: string, profile: NpcProfile, local: LocalGameTime): MoodId {
  const rules = profile.moodRules ?? {};
  for (const [index, exceptional] of (rules.exceptional ?? []).entries()) {
    if (inWindow(local.minutes, minute(exceptional.start), minute(exceptional.end)) &&
        selected(`${npcId}:${local.date}:${index}`, exceptional.chancePercent)) return exceptional.mood;
  }

  const ageEnergyShift = profile.age !== undefined && profile.age >= 65 ? -60 : profile.age !== undefined && profile.age <= 25 ? 60 : 0;
  const ageMealShift = profile.age !== undefined && profile.age >= 65 ? -30 : 0;
  const ageSleepShift = profile.age !== undefined && profile.age >= 65 ? -60 : profile.age !== undefined && profile.age <= 25 ? 60 : 0;
  const mealStart = 11 * 60 + ageMealShift + (rules.mealOffsetMinutes ?? 0);
  const tiredStart = 16 * 60 + ageEnergyShift + (rules.energyOffsetMinutes ?? 0);
  const relaxedStart = 19 * 60;
  const sleepyStart = 21 * 60 + ageSleepShift + (rules.sleepOffsetMinutes ?? 0);

  if (rules.lateSleepy && local.minutes >= sleepyStart && local.minutes < sleepyStart + 120) return 'sleepy';
  if (local.minutes >= relaxedStart) return 'relaxed';
  if (local.minutes >= tiredStart) return 'tired';
  if (local.minutes >= mealStart && local.minutes < mealStart + 60) return rules.middayMood ?? 'hungry';
  if (rules.morningHappy && local.minutes >= 6 * 60 && local.minutes < 10 * 60) return 'happy';
  return 'neutral';
}

@Injectable()
export class NpcMoodService {
  constructor(private readonly worldClock: WorldClockService) {}

  async resolve(client: PoolClient, userId: string, npcId: string): Promise<NpcMoodContext> {
    const result = await client.query<MoodContextRow>(`SELECT n.profile,n.current_mood_id
      FROM public.npcs n WHERE n.id=$2`, [userId, npcId]);
    const row = result.rows[0];
    if (!row) throw new ServiceUnavailableException('NPC mood context is unavailable.');
    const clock = await this.worldClock.read(userId, client);
    const moodId = resolveBaseNpcMood(npcId, npcProfileSchema.parse(row.profile), localGameTime(clock.gameTimeUtc, clock.timeZone));
    if (moodId !== row.current_mood_id) {
      await client.query('UPDATE public.npcs SET current_mood_id=$2,mood_updated_at=now() WHERE id=$1', [npcId, moodId]);
    }
    const mood = await client.query<{ id: string; label: string; guidance: string }>(
      'SELECT id,label,guidance FROM public.mood_types WHERE id=$1', [moodId]);
    const resolved = mood.rows[0];
    if (!resolved) throw new ServiceUnavailableException('NPC mood is unavailable.');
    return { id: moodIdSchema.parse(resolved.id), label: resolved.label, guidance: resolved.guidance };
  }
}
