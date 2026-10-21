import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { NpcRelationshipService, relationshipStage } from '../modules/npcs/npc-relationship.service';
import { classifySocialSignal } from '../modules/npcs/social-signal';

interface State { familiarity: number; affinity: number; interaction_mood_id: string | null; mood_expires_at: Date | null }
interface Event { id: string; date: string; familiarity: number; affinity: number }

function fakeClient(initial: Partial<State> = {}): { client: PoolClient; state: State; events: Event[]; queries: string[] } {
  const state: State = { familiarity: 0, affinity: 0, interaction_mood_id: null, mood_expires_at: null, ...initial };
  const events: Event[] = [];
  const queries: string[] = [];
  const anchor = new Date('2026-06-01T10:00:00.000Z');
  const query = async (sql: string, values: unknown[] = []) => {
    queries.push(sql);
    if (sql.includes('SELECT l.clock_time')) return { rows: [{ clock_time: anchor, clock_anchor: anchor, clock_rate: 1, time_zone: 'UTC' }], rowCount: 1 };
    if (sql.includes('INSERT INTO public.npc_relationships')) return { rows: [], rowCount: 1 };
    if (sql.includes('FROM public.npc_relationships') && sql.includes('FOR UPDATE')) return { rows: [{ ...state }], rowCount: 1 };
    if (sql.includes('SELECT 1 FROM public.npc_relationship_events')) {
      const found = events.some(event => event.id === values[2]);
      return { rows: found ? [{}] : [], rowCount: found ? 1 : 0 };
    }
    if (sql.includes('COALESCE(sum(familiarity_delta)')) {
      const daily = events.filter(event => event.date === values[2]);
      return { rows: [{ familiarity: String(daily.reduce((sum, event) => sum + event.familiarity, 0)),
        positive_affinity: String(daily.reduce((sum, event) => sum + Math.max(event.affinity, 0), 0)),
        negative_affinity: String(daily.reduce((sum, event) => sum + Math.max(-event.affinity, 0), 0)) }], rowCount: 1 };
    }
    if (sql.includes('INSERT INTO public.npc_relationship_events')) {
      events.push({ id: String(values[2]), date: String(values[3]), familiarity: Number(values[4]), affinity: Number(values[5]) });
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes('UPDATE public.npc_relationships SET familiarity=')) {
      state.familiarity = Number(values[2]); state.affinity = Number(values[3]);
      state.interaction_mood_id = values[4] as string | null; state.mood_expires_at = values[5] as Date | null;
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes('interaction_mood_id=NULL')) {
      state.interaction_mood_id = null; state.mood_expires_at = null;
      return { rows: [], rowCount: 1 };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  return { client: { query } as unknown as PoolClient, state, events, queries };
}

test('NPC-06 classifies only explicit deterministic social signals', () => {
  assert.equal(classifySocialSignal('Hello!', null), 'greeting');
  assert.equal(classifySocialSignal('Thank you very much.', null), 'thanks');
  assert.equal(classifySocialSignal('Could you help me?', 'ask_location'), 'polite_request');
  assert.equal(classifySocialSignal("I'm sorry.", null), 'apology');
  assert.equal(classifySocialSignal('You are an idiot.', null), 'insult');
  for (const text of ['What you name?', 'I do not understand', 'Is this a stupid question?', 'Maybe hello?']) {
    assert.equal(classifySocialSignal(text, null), null, text);
  }
});

test('NPC-06 derives documented stages at exact boundaries', () => {
  assert.equal(relationshipStage(0, 0), 'stranger');
  assert.equal(relationshipStage(10, 0), 'acquaintance');
  assert.equal(relationshipStage(30, 0), 'friendly');
  assert.equal(relationshipStage(55, 0), 'friend');
  assert.equal(relationshipStage(80, 0), 'close_friend');
  assert.equal(relationshipStage(100, -1), 'friend');
  assert.equal(relationshipStage(100, -21), 'strained');
});

test('NPC-06 caps daily gains and never exceeds score bounds', async () => {
  const fake = fakeClient({ familiarity: 98, affinity: 99 });
  const service = new NpcRelationshipService();
  for (let index = 0; index < 12; index++) await service.apply(fake.client, 'user', 'npc', 'thanks', randomUUID(), new Date('2026-06-01T10:00:00Z'));
  assert.equal(fake.state.familiarity, 100);
  assert.equal(fake.state.affinity, 100);
  assert.equal(fake.events.reduce((sum, event) => sum + event.familiarity, 0), 2);
  assert.equal(fake.events.reduce((sum, event) => sum + Math.max(event.affinity, 0), 0), 1);
});

test('NPC-06 expires reactions, escalates repeated insults, and softens with apology', async () => {
  const fake = fakeClient();
  const service = new NpcRelationshipService();
  const first = await service.apply(fake.client, 'user', 'npc', 'insult', randomUUID(), new Date('2026-06-01T10:00:00Z'));
  assert.equal(first.reactionMood, 'upset'); assert.equal(first.affinity, -8);
  const repeated = await service.apply(fake.client, 'user', 'npc', 'insult', randomUUID(), new Date('2026-06-01T10:01:00Z'));
  assert.equal(repeated.reactionMood, 'angry'); assert.equal(repeated.affinity, -20);
  const capped = await service.apply(fake.client, 'user', 'npc', 'insult', randomUUID(), new Date('2026-06-01T10:01:30Z'));
  assert.equal(capped.affinity, -24, 'negative affinity is capped per game day');
  const apology = await service.apply(fake.client, 'user', 'npc', 'apology', randomUUID(), new Date('2026-06-01T10:02:00Z'));
  assert.equal(apology.reactionMood, 'upset'); assert.equal(apology.affinity, -22);
  const expired = await service.context(fake.client, 'user', 'npc', new Date('2026-06-01T12:00:01Z'));
  assert.equal(expired.reactionMood, null); assert.equal(fake.state.affinity, -22);
});

test('NPC-06 serializes concurrent replays and applies a message key once', async () => {
  const fake = fakeClient();
  const service = new NpcRelationshipService();
  const key = randomUUID();
  let transactionQueue = Promise.resolve();
  const transaction = <T>(work: () => Promise<T>): Promise<T> => {
    const result = transactionQueue.then(work);
    transactionQueue = result.then(() => undefined, () => undefined);
    return result;
  };
  const [first, replay] = await Promise.all([
    transaction(() => service.apply(fake.client, 'user', 'npc', 'thanks', key)),
    transaction(() => service.apply(fake.client, 'user', 'npc', 'thanks', key)),
  ]);
  assert.deepEqual(replay, first);
  assert.equal(fake.events.length, 1);
  const lockIndex = fake.queries.findIndex(sql => sql.includes('FOR UPDATE'));
  const eventIndex = fake.queries.findIndex(sql => sql.includes('SELECT 1 FROM public.npc_relationship_events'));
  assert.ok(lockIndex >= 0 && lockIndex < eventIndex, 'relationship row must serialize concurrent turns before idempotency check');
});

