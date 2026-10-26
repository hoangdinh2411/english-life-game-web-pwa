import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module';
import { ConversationsService } from '../modules/conversations/conversations.service';
import { ConversationsRepository } from '../modules/conversations/conversations.repository';
import { DialogueService } from '../modules/dialogue/dialogue.service';
import { QuestsService } from '../modules/quests/quests.service';
import { CoffeeQuestService } from '../modules/quests/coffee-quest.service';
import { LifeService } from '../modules/life/life.service';
import { SellerService } from '../modules/conversations/seller.service';
import { AiService } from '../modules/ai/ai.service';
import { NpcPromptService } from '../modules/ai/npc-prompt.service';
import { AiUsageService } from '../modules/ai/ai-usage.service';
import { NpcPresenceService } from '../modules/npcs/npc-presence.service';
import { NpcRelationshipService } from '../modules/npcs/npc-relationship.service';
import { NpcMoodService } from '../modules/npcs/npc-mood.service';

test('T10c all NPCs use AI after scripts while pending gameplay and replay bypass it', async () => {
  let npcId = 'npc_mila_florist';
  let understood = false;
  let replay = false;
  let aiCalls = 0;
  let energyCharges = 0;
  let questCalls = 0;
  let pending = false;
  let enabled = true;
  let limited = false;
  let aiFallback = false;
  let presenceChecks = 0;
  let relationshipCalls = 0;
  const order: string[] = [];
  const scripted = { text: 'Scripted reply', node: { id: 'global_repeat' }, intent: null, misunderstood: true };
  let arrival = { locationId: 'loc_station' };
  const replayedArrival = { locationId: 'loc_station' };
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ConversationsRepository).useValue({
      transaction: async (work: (client: unknown) => Promise<unknown>) => work(undefined),
      load: async () => ({ npc_id: npcId }),
      messages: async () => [],
      replay: async () => replay ? {
        arrival: replayedArrival, intent: null, misunderstood: false,
        playerMessage: { sender: 'player', text: 'Tell me about autumn' },
        npcMessage: { sender: 'npc', text: 'Saved reply' },
      } : null,
      context: async () => ({ npcId, roleId: 'townsperson', personality: 'cheerful' }),
      variationIndex: async () => 0,
      pendingQuest: async () => pending,
      append: async (_client: unknown, _id: string, sender: string, text: string) => ({ sender, text }),
      setNode: async (_client: unknown, _id: string, nodeId: string) => assert.ok(['global_repeat', 'global_ai_limit'].includes(nodeId)),
    })
    .overrideProvider(DialogueService).useValue({
      reply: async () => { order.push('script'); return { ...scripted, misunderstood: !understood }; },
      node: async (_context: unknown, id: string) => id === 'global_ai_limit'
        ? { text: 'Friendly limit', node: { id }, intent: null, misunderstood: false } : scripted,
      isScriptTopic: async () => { throw new Error('obsolete topic gate called'); },
    })
    .overrideProvider(QuestsService).useValue({
      getArrival: async () => arrival,
      applyReceptionistIntent: async () => { questCalls++; },
    })
    .overrideProvider(LifeService).useValue({
      consumeMessage: async () => { energyCharges++; }, venueOpen: async () => true, catalog: async () => [],
    })
    .overrideProvider(CoffeeQuestService).useValue({ get: async () => ({}) })
    .overrideProvider(SellerService).useValue({ reply: async () => ({
      text: 'Scripted sale', nodeId: 'global_repeat', intent: 'clarify', misunderstood: !understood,
    }) })
    .overrideProvider(NpcPromptService).useValue({ build: async () => ({ text: 'Football?', prompt: { system: 'persona', history: [] } }) })
    .overrideProvider(AiService).useValue({ get enabled() { return enabled; }, replyTracked: async () => {
      order.push('ai'); aiCalls++;
      return { text: aiFallback ? 'Scripted reply' : 'AI text', provider: 'mock', model: 'mock', inputTokens: 2, outputTokens: 2,
        fallback: aiFallback, usedProvider: true };
    } })
    .overrideProvider(AiUsageService).useValue({ limited: async () => limited, record: async () => undefined })
    .overrideProvider(NpcPresenceService).useValue({ assertCanStart: async () => { presenceChecks++; } })
    .overrideProvider(NpcRelationshipService).useValue({
      context: async () => ({ familiarity: 0, affinity: 0, stage: 'stranger', reactionMood: null, reactionExpiresAt: null }),
      apply: async () => { relationshipCalls++; return {
      familiarity: 1, affinity: -100, stage: 'strained', reactionMood: null, reactionExpiresAt: null,
    }; } })
    .overrideProvider(NpcMoodService).useValue({ resolve: async () => ({ id: 'neutral', label: 'Neutral', guidance: 'Be neutral.' }) })
    .compile();
  try {
    const service = module.get(ConversationsService);
    const send = (text = 'Tell me about autumn') => service.send('existing-user', randomUUID(), {
      text, clientMessageId: randomUUID(),
    });
    const first = await send();
    assert.match(first.npcMessage.text, /AI text/);
    assert.equal(first.ai, true);
    assert.equal(first.intent, null);
    assert.deepEqual(first.arrival, arrival);
    assert.equal(energyCharges, 1);
    assert.deepEqual(order, ['script', 'ai']);
    aiFallback = true;
    const fallback = await send();
    assert.equal(fallback.npcMessage.text, 'Scripted reply');
    assert.equal(fallback.ai, undefined);
    aiFallback = false;
    replay = true;
    arrival = { locationId: 'loc_town_street' };
    assert.deepEqual((await send()).arrival, arrival);
    assert.equal(aiCalls, 2); assert.equal(energyCharges, 2);
    arrival = { locationId: 'loc_station' };
    replay = false; understood = true;
    assert.equal((await send()).npcMessage.text, 'Scripted reply');
    const scriptedChunks: string[] = [];
    await service.sendStreaming('existing-user', randomUUID(), npcId, {
      text: 'Tax office services', clientMessageId: randomUUID(),
    }, async chunk => { scriptedChunks.push(chunk); }, new AbortController().signal);
    assert.deepEqual(scriptedChunks, [], 'scripted text must wait for its speech-ready saved turn');
    understood = false;
    for (const id of ['npc_receptionist', 'npc_cafe_waiter', 'npc_mia']) {
      npcId = id;
      assert.match((await send()).npcMessage.text, /AI text/);
    }
    assert.equal(aiCalls, 5); assert.equal(questCalls, 0);
    pending = true; await send(); pending = false;
    limited = true; assert.equal((await send()).npcMessage.text, 'Friendly limit'); limited = false;
    enabled = false; await send();
    assert.equal(aiCalls, 5);
    npcId = 'npc_mia'; understood = true;
    assert.equal((await send('Thank you')).npcMessage.text, 'Scripted sale');
    assert.equal(relationshipCalls, 1, 'relationship state must not change seller routing');
    replay = true; await send('Thank you');
    assert.equal(relationshipCalls, 1, 'replayed seller turns must not change the relationship twice');
    assert.equal(presenceChecks, 0, 'continuing an existing conversation must not re-check presence');
  } finally { await module.close(); }
});
