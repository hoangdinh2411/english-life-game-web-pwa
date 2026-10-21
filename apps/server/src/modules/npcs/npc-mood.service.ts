import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { gameTimeAt, moodIdSchema, npcProfileSchema, type MoodId, type NpcProfile } from '@life-abroad/shared';
import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';

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
  clock_time: Date;
  clock_anchor: Date;
  clock_rate: number;
  time_zone: string;
}

function minute(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours! * 60 + minutes!;
}

function inWindow(now: number, start: number, end: number): boolean {
  return start < end ? now >= start && now < end : now >= start || now < end;
}

export function localGameTime(instant: Date, timeZone: string): LocalGameTime {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes): string => parts.find(part => part.type === type)?.value ?? '';
  return { date: `${value('year')}-${value('month')}-${value('day')}`, minutes: Number(value('hour')) * 60 + Number(value('minute')) };
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
  async resolve(client: PoolClient, userId: string, npcId: string): Promise<NpcMoodContext> {
    const result = await client.query<MoodContextRow>(`SELECT n.profile,n.current_mood_id,
      l.clock_time,l.clock_anchor,l.clock_rate,co.time_zone
      FROM public.npcs n
      JOIN public.characters ch ON ch.user_id=$1
      JOIN public.countries co ON co.id=ch.country_id
      JOIN public.player_life l ON l.user_id=ch.user_id
      WHERE n.id=$2`, [userId, npcId]);
    const row = result.rows[0];
    if (!row) throw new ServiceUnavailableException('NPC mood context is unavailable.');
    const gameTime = gameTimeAt({ gameTime: row.clock_time, realTime: row.clock_anchor, rate: row.clock_rate }, new Date());
    const moodId = resolveBaseNpcMood(npcId, npcProfileSchema.parse(row.profile), localGameTime(gameTime, row.time_zone));
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
