import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { Test } from '@nestjs/testing';
import { Client } from 'pg';
import { LifeService } from '../modules/life/life.service';
import { NpcPromptService } from '../modules/ai/npc-prompt.service';

test('T10c prompt uses DB persona, levels and hours; only six turns; current input/history redact identifiers', async t => {
  const module = await Test.createTestingModule({ providers: [NpcPromptService,
    { provide: LifeService, useValue: { venueOpen: async () => false } },
  ] }).compile();
  const client = Object.assign(new Client(), { release: () => undefined }); // No connection is opened.
  const userId = '12345678-1234-1234-1234-123456789abc';
  t.mock.method(client, 'query', async (sql: string) => ({ rows: sql.includes('FROM public.npcs') ? [{
    name: 'Mia', role: 'Barista', personality: 'cheerful', speaking_level: 'A2', place: 'Station café',
    place_type: 'cafe', player_level: 'B1', private_display_name: 'Private Learner', private_character_name: 'Private Avatar',
  }] : Array.from({ length: 16 }, (_, index) => ({ sender: index % 2 === 0 ? 'npc' : 'player',
    text: `turn-${index}: Private Learner, Private Avatar, private@example.com, ${userId}` })) }));
  try {
    const result = await module.get(NpcPromptService).build(client, userId, 'npc_mia', 'session',
      `My name is Private Learner, avatar Private Avatar, private@example.com, ${userId}`);
    assert.match(result.prompt.system, /Mia|Barista/);
    for (const value of ['cheerful', 'A2', 'B1', 'Station café', '"open":false']) assert.ok(result.prompt.system.includes(value));
    assert.equal(result.prompt.history.length, 12);
    assert.match(result.prompt.history[0]!.text, /turn-11/);
    assert.doesNotMatch(JSON.stringify(result), /Private Learner|Private Avatar|private@example\.com|12345678-1234|turn-12/);
    assert.match(result.prompt.system, /Repeat the correct English form naturally/);
    assert.match(result.prompt.system, /Never state prices or promise items/);
    assert.match(result.prompt.system, /Answer the player's latest message directly/);
    assert.match(result.prompt.system, /Do not greet the player unless the latest message is a greeting/);
    assert.match(result.prompt.system, /Do not replace an answer with a generic invitation to talk/);
  } finally { await module.close(); }
});
