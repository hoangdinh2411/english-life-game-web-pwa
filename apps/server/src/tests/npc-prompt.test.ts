import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { Test } from '@nestjs/testing';
import { Client } from 'pg';
import { LifeService } from '../modules/life/life.service';
import { NpcPromptService } from '../modules/ai/npc-prompt.service';
import { NpcMoodService } from '../modules/npcs/npc-mood.service';
import { NpcRelationshipService } from '../modules/npcs/npc-relationship.service';

test('T10c prompt uses DB persona, levels and hours; only six turns; current input/history redact identifiers', async t => {
  const module = await Test.createTestingModule({ providers: [NpcPromptService,
    { provide: LifeService, useValue: { venueOpen: async () => false } },
    { provide: NpcMoodService, useValue: { resolve: async () => ({ id: 'happy', label: 'Happy', guidance: 'Sound upbeat.' }) } },
    { provide: NpcRelationshipService, useValue: { context: async () => ({ familiarity: 30, affinity: 20,
      stage: 'friendly', reactionMood: 'upset', reactionExpiresAt: new Date().toISOString() }) } },
  ] }).compile();
  const client = Object.assign(new Client(), { release: () => undefined }); // No connection is opened.
  const userId = '12345678-1234-1234-1234-123456789abc';
  t.mock.method(client, 'query', async (sql: string) => ({ rows: sql.includes('FROM public.npcs') ? [{
    name: 'Mia', role: 'Barista', personality: 'cheerful', speaking_level: 'A2', place: 'Station café',
    profile: { profileVersion: 1, hobbies: ['listening to jazz'], favouriteFood: 'cinnamon bun',
      presenceSchedule: { timeZoneSource: 'player_country', weeklySlots: [
        { days: ['mon'], start: '09:00', end: '17:00', locationId: 'loc_station_cafe' },
      ] }, moodRules: { morningHappy: true } },
    place_type: 'cafe', city: 'Mapleford', country: 'Canada', player_level: 'B1',
    private_display_name: 'Private Learner', private_character_name: 'Private Avatar',
  }] : Array.from({ length: 16 }, (_, index) => ({ sender: index % 2 === 0 ? 'npc' : 'player',
    text: `turn-${index}: Private Learner, Private Avatar, private@example.com, ${userId}` })) }));
  try {
    const result = await module.get(NpcPromptService).build(client, userId, 'npc_mia', 'session',
      `My name is Private Learner, avatar Private Avatar, private@example.com, ${userId}`);
    assert.match(result.prompt.system, /Mia|Barista/);
    for (const value of ['cheerful', 'B1', 'Station café', 'Mapleford', 'Canada', '"open":false']) assert.ok(result.prompt.system.includes(value));
    assert.match(result.prompt.system, /listening to jazz|cinnamon bun/);
    assert.match(result.prompt.system, /"effectiveMood":"upset"/);
    assert.match(result.prompt.system, /"relationshipStage":"friendly"/);
    assert.doesNotMatch(result.prompt.system, /family/);
    assert.doesNotMatch(result.prompt.system, /presenceSchedule|moodRules|profileVersion|playerEnglishLevel/);
    assert.match(result.prompt.system, /Never invent personal facts/);
    assert.equal(result.prompt.history.length, 12);
    assert.match(result.prompt.history[0]!.text, /turn-11/);
    assert.doesNotMatch(JSON.stringify(result), /Private Learner|Private Avatar|private@example\.com|12345678-1234|turn-12/);
    assert.match(result.prompt.system, /weave the natural English form into your reply once/);
    assert.match(result.prompt.system, /do not announce a correction/);
    assert.match(result.prompt.system, /Ignore harmless minor errors/);
    assert.match(result.prompt.system, /Never state prices or promise items/);
    assert.match(result.prompt.system, /Answer the player's latest message directly/);
    assert.match(result.prompt.system, /Do not greet the player unless the latest message is a greeting/);
    assert.match(result.prompt.system, /Do not replace an answer with a generic invitation to talk/);
    assert.match(result.prompt.system, /serving a customer.*request first.*store service/i);
  } finally { await module.close(); }
});
