import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { npcRelationshipSchema, type NpcRelationship } from '@life-abroad/shared';
import type { PoolClient } from 'pg';
import type { SocialSignal } from './social-signal';
import { WorldClockService, zonedGameTime } from '../world-clock/world-clock.service';

const DAILY_FAMILIARITY_CAP = 5;
const DAILY_POSITIVE_AFFINITY_CAP = 8;
const DAILY_NEGATIVE_AFFINITY_CAP = 24;

interface RelationshipRow {
  familiarity: number;
  affinity: number;
  interaction_mood_id: string | null;
  mood_expires_at: Date | null;
}

interface DailyTotals { familiarity: string; positive_affinity: string; negative_affinity: string }

interface Change { familiarity: number; affinity: number; mood: 'upset' | 'angry' | null; durationMinutes: number }

export function relationshipStage(familiarity: number, affinity: number): NpcRelationship['stage'] {
  if (affinity < -20) return 'strained';
  if (familiarity < 10) return 'stranger';
  if (familiarity < 30) return 'acquaintance';
  if (familiarity < 55) return 'friendly';
  if (familiarity < 80) return 'friend';
  return affinity >= 0 ? 'close_friend' : 'friend';
}

function requestedChange(signal: SocialSignal, currentMood: string | null): Change {
  switch (signal) {
    case 'greeting': return { familiarity: 1, affinity: 1, mood: null, durationMinutes: 0 };
    case 'thanks': return { familiarity: 1, affinity: 2, mood: null, durationMinutes: 0 };
    case 'polite_request': return { familiarity: 1, affinity: 1, mood: null, durationMinutes: 0 };
    case 'apology': return { familiarity: 1, affinity: 2, mood: currentMood === 'angry' ? 'upset' : null, durationMinutes: 60 };
    case 'insult': return { familiarity: 0, affinity: currentMood === 'upset' || currentMood === 'angry' ? -12 : -8,
      mood: currentMood === 'upset' || currentMood === 'angry' ? 'angry' : 'upset', durationMinutes: 120 };
  }
}

function boundedChange(change: Change, totals: { familiarity: number; positiveAffinity: number; negativeAffinity: number }): Change {
  const familiarity = Math.min(change.familiarity, Math.max(0, DAILY_FAMILIARITY_CAP - totals.familiarity));
  const affinity = change.affinity >= 0
    ? Math.min(change.affinity, Math.max(0, DAILY_POSITIVE_AFFINITY_CAP - totals.positiveAffinity))
    : -Math.min(-change.affinity, Math.max(0, DAILY_NEGATIVE_AFFINITY_CAP - totals.negativeAffinity));
  return { ...change, familiarity, affinity };
}

function output(row: RelationshipRow, gameTime: Date): NpcRelationship {
  const activeMood = row.mood_expires_at && row.mood_expires_at > gameTime ? row.interaction_mood_id : null;
  return npcRelationshipSchema.parse({ familiarity: row.familiarity, affinity: row.affinity,
    stage: relationshipStage(row.familiarity, row.affinity), reactionMood: activeMood,
    reactionExpiresAt: activeMood ? row.mood_expires_at?.toISOString() : null });
}

@Injectable()
export class NpcRelationshipService {
  constructor(private readonly worldClock: WorldClockService) {}

  async context(client: PoolClient, userId: string, npcId: string): Promise<NpcRelationship> {
    const gameTime = (await this.worldClock.read(userId, client)).gameTimeUtc;
    const row = await this.lock(client, userId, npcId);
    if (row.mood_expires_at && row.mood_expires_at <= gameTime) {
      row.interaction_mood_id = null; row.mood_expires_at = null;
      await client.query(`UPDATE public.npc_relationships SET interaction_mood_id=NULL,mood_expires_at=NULL,updated_at=now()
        WHERE user_id=$1 AND npc_id=$2`, [userId, npcId]);
    }
    return output(row, gameTime);
  }

  async apply(client: PoolClient, userId: string, npcId: string, signal: SocialSignal,
    clientMessageId: string): Promise<NpcRelationship> {
    const clock = await this.worldClock.read(userId, client);
    const gameTime = clock.gameTimeUtc;
    const gameDate = zonedGameTime(gameTime, clock.timeZone).date;
    const row = await this.lock(client, userId, npcId);
    if (row.mood_expires_at && row.mood_expires_at <= gameTime) {
      row.interaction_mood_id = null; row.mood_expires_at = null;
    }
    const existing = await client.query(`SELECT 1 FROM public.npc_relationship_events
      WHERE user_id=$1 AND npc_id=$2 AND client_message_id=$3`, [userId, npcId, clientMessageId]);
    if (existing.rowCount) return output(row, gameTime);
    const daily = await client.query<DailyTotals>(`SELECT
      COALESCE(sum(familiarity_delta),0)::text AS familiarity,
      COALESCE(sum(GREATEST(affinity_delta,0)),0)::text AS positive_affinity,
      COALESCE(sum(GREATEST(-affinity_delta,0)),0)::text AS negative_affinity
      FROM public.npc_relationship_events WHERE user_id=$1 AND npc_id=$2 AND game_date=$3`, [userId, npcId, gameDate]);
    const totals = daily.rows[0]!;
    const change = boundedChange(requestedChange(signal, row.interaction_mood_id), {
      familiarity: Number(totals.familiarity), positiveAffinity: Number(totals.positive_affinity),
      negativeAffinity: Number(totals.negative_affinity),
    });
    const familiarity = Math.max(0, Math.min(100, row.familiarity + change.familiarity));
    const affinity = Math.max(-100, Math.min(100, row.affinity + change.affinity));
    const mood = change.mood ?? (signal === 'apology' ? null : row.interaction_mood_id);
    const expires = mood ? new Date(gameTime.getTime() + change.durationMinutes * 60_000) : null;
    await client.query(`INSERT INTO public.npc_relationship_events
      (user_id,npc_id,client_message_id,game_date,familiarity_delta,affinity_delta) VALUES ($1,$2,$3,$4,$5,$6)`,
    [userId, npcId, clientMessageId, gameDate, familiarity - row.familiarity, affinity - row.affinity]);
    await client.query(`UPDATE public.npc_relationships SET familiarity=$3,affinity=$4,interaction_mood_id=$5,
      mood_expires_at=$6,last_interaction_at=$7,updated_at=now() WHERE user_id=$1 AND npc_id=$2`,
    [userId, npcId, familiarity, affinity, mood, expires, gameTime]);
    return output({ familiarity, affinity, interaction_mood_id: mood, mood_expires_at: expires }, gameTime);
  }

  private async lock(client: PoolClient, userId: string, npcId: string): Promise<RelationshipRow> {
    await client.query(`INSERT INTO public.npc_relationships (user_id,npc_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [userId, npcId]);
    const result = await client.query<RelationshipRow>(`SELECT familiarity,affinity,interaction_mood_id,mood_expires_at
      FROM public.npc_relationships WHERE user_id=$1 AND npc_id=$2 FOR UPDATE`, [userId, npcId]);
    const row = result.rows[0];
    if (!row) throw new ServiceUnavailableException('NPC relationship is unavailable.');
    return row;
  }

}

