import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { CachedDialogueNode, DialogueCacheService } from '../infrastructure/content/dialogue-cache.service';
import { DatabaseService } from '../infrastructure/database/database.service';
import { loadSeedContent } from '../infrastructure/content/seed-content';
import { DialogueService } from '../modules/dialogue/dialogue.service';

const receptionist = { npcId: 'npc_receptionist', roleId: 'station_receptionist', personality: 'cheerful' };

async function fixture() {
  const content = await loadSeedContent(resolve('../../content'));
  const nodes: CachedDialogueNode[] = content.dialogues.flatMap(file => file.nodes.map(node => ({
    node, scope: file.scope, version: file.version,
    roleId: file.scope === 'role' ? file.role : null,
    npcId: file.scope === 'npc' ? file.npcId : null,
  })));
  let queries = 0;
  class ContentDatabase extends DatabaseService {
    override async query<Row extends import('pg').QueryResultRow = import('pg').QueryResultRow>(): Promise<import('pg').QueryResult<Row>> {
      queries++;
      const rows = nodes.map(({ node, scope, version, roleId, npcId }) => {
        const { id, text, ...rules } = node;
        return { id, scope, version, role_id: roleId, npc_id: npcId, npc_text: text, next_rules: rules };
      });
      // The generic DB mock models the exact dialogue SELECT row shape.
      return { rows: rows as unknown as Row[], rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] };
    }
  }
  const cache = new DialogueCacheService(new ContentDatabase(new ConfigService()));
  return { content, nodes, cache, engine: new DialogueService(cache), queries: () => queries };
}

test('T4 recognizes polite ticket and directions requests and imperfect meaningful English', async () => {
  const { engine, content } = await fixture();
  for (const input of ['Could I have a bus ticket, please?', 'Hi! I would like a bus ticket.', 'Can I get a ticket for the bus?', 'I need bus ticket', 'A ticket to Maplewood, please.']) {
    const reply = await engine.reply(receptionist, input);
    assert.equal(reply.intent, 'request_bus_ticket', input);
    assert.equal(reply.node.id, 'receptionist_ticket_request');
    assert.equal(reply.node.completesStep, 'arrival_ask');
    assert.equal(reply.misunderstood, false);
  }
  for (const input of ['How do I get to town?', 'Could you tell me how to reach town?', 'Please give me directions to town.', 'Where is the town centre?', "I don't know how to reach town."]) {
    assert.equal((await engine.reply(receptionist, input)).intent, 'ask_town_directions', input);
  }
  for (const input of ['How do I get to the tax office?', 'How I get to town', 'How can we go to the town centre?']) {
    assert.equal((await engine.reply(receptionist, input)).intent, 'ask_town_directions', input);
  }
  const quest = content.quests.find(entry => entry.id === 'q_station_arrival');
  assert.deepEqual(quest?.steps.map(step => step.id), ['arrival_greet', 'arrival_ask', 'arrival_ticket', 'arrival_exit']);
  assert.deepEqual(quest?.steps[1]?.doneWhen, { intent: 'ask_town_directions', alternativeIntents: ['request_bus_ticket'] });
});

test('T4 applies NPC then role then global intent precedence and personality wording', async () => {
  const { engine } = await fixture();
  assert.equal((await engine.reply(receptionist, 'bus ticket please')).node.id, 'receptionist_ticket_request');
  assert.equal((await engine.reply(receptionist, 'ticket please')).node.id, 'station_receptionist_ticket');
  assert.equal((await engine.reply(receptionist, 'I feel fine')).node.id, 'global_nice');
  const greeting = await engine.reply(receptionist, 'hello');
  assert.equal(greeting.node.id, 'receptionist_welcome');
  assert.equal(greeting.text, greeting.node.text.cheerful);
  const defaultGreeting = await engine.reply({ ...receptionist, personality: 'unknown' }, 'hello');
  assert.equal(defaultGreeting.text, defaultGreeting.node.text.default);
  const other = { ...receptionist, npcId: 'another_receptionist' };
  assert.equal((await engine.reply(other, 'bus ticket')).node.id, 'station_receptionist_ticket');
  const stranger = { ...other, roleId: 'unrelated' };
  const global = await engine.reply(stranger, 'hello');
  assert.equal(global.node.id, 'global_how_are_you');
  assert.equal((await engine.reply(stranger, 'bus ticket')).node.id, 'global_repeat');
});

test('T4 misunderstandings, boundaries and refusals never return a successful intent', async () => {
  const { engine } = await fixture();
  for (const input of ['', '   ', 'this is something else', 'ticketseller', "I don't want a bus ticket", 'not a bus ticket', '🚀', 'SELECT * FROM quests']) {
    const reply = await engine.reply(receptionist, input);
    assert.equal(reply.intent, null, input);
    assert.equal(reply.misunderstood, true);
    assert.equal(reply.node.id, 'receptionist_repeat');
    assert.equal(reply.node.completesStep, undefined);
  }
  const role = { ...receptionist, npcId: 'another' };
  assert.equal((await engine.reply(role, 'unknown')).node.id, 'station_receptionist_repeat');
  assert.equal((await engine.reply({ ...role, roleId: 'unrelated', currentNodeId: 'receptionist_start' }, 'unknown')).node.id, 'global_repeat');
});

test('T4 cache shares concurrent loads and protects content from caller mutation', async () => {
  const { engine, cache, queries } = await fixture();
  await Promise.all(Array.from({ length: 10 }, () => engine.reply(receptionist, 'hello')));
  assert.equal(queries(), 1);
  const reply = await engine.reply(receptionist, 'hello');
  reply.node.text.default = 'mutated';
  assert.notEqual((await engine.reply(receptionist, 'hello')).node.text.default, 'mutated');
  assert.ok((await cache.getNodes()).length > 0);
  assert.equal(queries(), 1);
});

test('T4 broken or cross-NPC links fall back safely; missing fallback fails closed', async () => {
  const { nodes, engine } = await fixture();
  const start = nodes.find(entry => entry.node.id === 'receptionist_start');
  assert.ok(start?.node.intents?.[0]);
  start.node.intents[0].next = 'mia_jazz';
  // Also remove the matching role rule to exercise the broken link itself.
  for (const entry of nodes) if (entry.scope === 'role') entry.node.intents = [];
  const reply = await engine.reply(receptionist, 'bus ticket');
  assert.equal(reply.intent, null);
  assert.equal(reply.node.id, 'receptionist_repeat');
  const unsafe = await fixture();
  const unsafeStart = unsafe.nodes.find(entry => entry.node.id === 'receptionist_start');
  assert.ok(unsafeStart);
  unsafeStart.node.fallback = 'receptionist_welcome';
  const unsafeFallback = await unsafe.engine.reply(receptionist, 'unknown');
  assert.equal(unsafeFallback.node.id, 'station_receptionist_repeat');
  assert.equal(unsafeFallback.node.completesStep, undefined);
  class EmptyCache extends DialogueCacheService {
    override async getNodes(): Promise<CachedDialogueNode[]> { return []; }
  }
  const empty = new DialogueService(new EmptyCache(new DatabaseService(new ConfigService())));
  await assert.rejects(empty.reply(receptionist, 'unknown'), ServiceUnavailableException);
});

test('T4 failed cache loads can retry', async () => {
  let attempts = 0;
  class RetryingDatabase extends DatabaseService {
    override async query<Row extends import('pg').QueryResultRow = import('pg').QueryResultRow>(): Promise<import('pg').QueryResult<Row>> {
      if (++attempts === 1) throw new Error('temporary database failure');
      return { rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] };
    }
  }
  const cache = new DialogueCacheService(new RetryingDatabase(new ConfigService()));
  await assert.rejects(cache.getNodes(), /temporary database failure/);
  assert.deepEqual(await cache.getNodes(), []);
  assert.equal(attempts, 2);
});
