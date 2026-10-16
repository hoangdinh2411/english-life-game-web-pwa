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

test('T10c all NPCs check scripts, pending state and topics before AI; replay bypasses it', async () => {
  let npcId = 'npc_mila_florist';
  let understood = false;
  let replay = false;
  let aiCalls = 0;
  let energyCharges = 0;
  let questCalls = 0;
  let pending = false;
  let topic = false;
  let enabled = true;
  let limited = false;
  const order: string[] = [];
  const scripted = { text: 'Scripted reply', node: { id: 'global_repeat' }, intent: null, misunderstood: true };
  let arrival = { locationId: 'loc_station' };
  const replayedArrival = { locationId: 'loc_station' };
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ConversationsRepository).useValue({
      transaction: async (work: (client: unknown) => Promise<unknown>) => work(undefined),
      load: async () => ({ npc_id: npcId }),
      replay: async () => replay ? {
        arrival: replayedArrival, intent: null, misunderstood: false, correction: null,
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
      isScriptTopic: async () => topic,
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
      return { text: 'AI text', provider: 'mock', model: 'mock', inputTokens: 2, outputTokens: 2,
        fallback: false, usedProvider: true };
    } })
    .overrideProvider(AiUsageService).useValue({ limited: async () => limited, record: async () => undefined }).compile();
  try {
    const service = module.get(ConversationsService);
    const send = () => service.send('existing-user', randomUUID(), {
      text: 'Tell me about autumn', clientMessageId: randomUUID(), coach: false,
    });
    const first = await send();
    assert.match(first.npcMessage.text, /AI text/);
    assert.equal(first.intent, null);
    assert.deepEqual(first.arrival, arrival);
    assert.equal(energyCharges, 1);
    assert.deepEqual(order, ['script', 'ai']);
    replay = true;
    arrival = { locationId: 'loc_town_street' };
    assert.deepEqual((await send()).arrival, arrival);
    assert.equal(aiCalls, 1); assert.equal(energyCharges, 1);
    arrival = { locationId: 'loc_station' };
    replay = false; understood = true;
    assert.equal((await send()).npcMessage.text, 'Scripted reply');
    understood = false;
    for (const id of ['npc_receptionist', 'npc_cafe_waiter', 'npc_mia']) {
      npcId = id;
      assert.match((await send()).npcMessage.text, /AI text/);
    }
    assert.equal(aiCalls, 4); assert.equal(questCalls, 0);
    pending = true; await send(); pending = false;
    topic = true; await send(); topic = false;
    limited = true; assert.equal((await send()).npcMessage.text, 'Friendly limit'); limited = false;
    enabled = false; await send();
    assert.equal(aiCalls, 4);
  } finally { await module.close(); }
});
