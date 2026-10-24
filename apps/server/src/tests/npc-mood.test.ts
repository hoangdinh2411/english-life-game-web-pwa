import assert from 'node:assert/strict';
import test from 'node:test';
import type { NpcProfile } from '@life-abroad/shared';
import { localGameTime, resolveBaseNpcMood } from '../modules/npcs/npc-mood.service';
import { NpcMoodService } from '../modules/npcs/npc-mood.service';
import { Client } from 'pg';

const profile = (changes: Partial<NpcProfile> = {}): NpcProfile => ({ profileVersion: 1, ...changes });
const at = (minutes: number, date = '2000-01-01') => ({ date, minutes });

test('NPC-04 resolves exact base mood boundaries without a scheduler', () => {
  const rules = profile({ moodRules: { morningHappy: true, middayMood: 'stressed', lateSleepy: true } });
  for (const [minutes, expected] of [
    [359, 'neutral'], [360, 'happy'], [599, 'happy'], [600, 'neutral'],
    [659, 'neutral'], [660, 'stressed'], [719, 'stressed'], [720, 'neutral'],
    [959, 'neutral'], [960, 'tired'], [1139, 'tired'], [1140, 'relaxed'],
    [1259, 'relaxed'], [1260, 'sleepy'], [1379, 'sleepy'], [1380, 'relaxed'],
  ] as const) assert.equal(resolveBaseNpcMood('npc_test', rules, at(minutes)), expected, String(minutes));
});

test('NPC-04 age shifts only meal, energy and sleep timing', () => {
  const older = profile({ age: 70, moodRules: { lateSleepy: true } });
  const younger = profile({ age: 20, moodRules: { lateSleepy: true } });
  assert.equal(resolveBaseNpcMood('older', older, at(10 * 60 + 30)), 'hungry');
  assert.equal(resolveBaseNpcMood('older', older, at(15 * 60)), 'tired');
  assert.equal(resolveBaseNpcMood('older', older, at(20 * 60)), 'sleepy');
  assert.equal(resolveBaseNpcMood('younger', younger, at(16 * 60)), 'neutral');
  assert.equal(resolveBaseNpcMood('younger', younger, at(22 * 60)), 'sleepy');
  assert.notEqual(resolveBaseNpcMood('older', older, at(8 * 60)), 'angry');
  assert.notEqual(resolveBaseNpcMood('younger', younger, at(8 * 60)), 'happy');
});

test('NPC-04 exceptional moods are authored, stable by NPC/date, and roll over', () => {
  const authored = profile({ moodRules: { exceptional: [{ mood: 'upset', start: '09:00', end: '10:00', chancePercent: 100 }] } });
  assert.equal(resolveBaseNpcMood('npc_test', authored, at(9 * 60, '2000-01-01')), 'upset');
  assert.equal(resolveBaseNpcMood('npc_test', authored, at(9 * 60, '2000-01-01')), 'upset');
  assert.equal(resolveBaseNpcMood('npc_test', profile(), at(9 * 60, '2000-01-01')), 'neutral');
  assert.equal(resolveBaseNpcMood('npc_test', authored, at(0, '2000-01-02')), 'neutral');
});

test('NPC-04 converts server game instants through the selected IANA zone across DST', () => {
  assert.deepEqual(localGameTime(new Date('2026-03-29T00:30:00Z'), 'Europe/Stockholm'), { date: '2026-03-29', minutes: 90 });
  assert.deepEqual(localGameTime(new Date('2026-03-29T01:30:00Z'), 'Europe/Stockholm'), { date: '2026-03-29', minutes: 210 });
  assert.deepEqual(localGameTime(new Date('2026-10-25T00:30:00Z'), 'Europe/Stockholm'), { date: '2026-10-25', minutes: 150 });
  assert.deepEqual(localGameTime(new Date('2026-10-25T01:30:00Z'), 'Europe/Stockholm'), { date: '2026-10-25', minutes: 150 });
});

test('NPC-04 runtime reads server clock/country/profile and lazily persists a changed mood', async t => {
  const client = Object.assign(new Client(), { release: () => undefined });
  const queries: string[] = [];
  t.mock.method(client, 'query', async (sql: string) => {
    queries.push(sql);
    if (sql.includes('FROM public.npcs')) return { rows: [{
      profile: { profileVersion: 1, moodRules: { morningHappy: true } }, current_mood_id: 'neutral',
    }] };
    if (sql.startsWith('SELECT id,label')) return { rows: [{ id: 'happy', label: 'Happy', guidance: 'Sound upbeat.' }] };
    return { rows: [] };
  });
  const worldClock = { read: async () => ({ gameTimeUtc: new Date('2026-06-01T06:00:00Z'), timeZone: 'Europe/Stockholm' }) };
  const mood = await new NpcMoodService(worldClock as never).resolve(client, 'user-id', 'npc_mia');
  assert.equal(mood.id, 'happy');
  assert.ok(queries.some(sql => sql.startsWith('UPDATE public.npcs SET current_mood_id')));
});
