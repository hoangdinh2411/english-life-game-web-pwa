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

test('T10b only unknown resident small talk uses AI; replay and scripted gameplay bypass it', async () => {
  let npcId = 'npc_mila_florist';
  let understood = false;
  let replay = false;
  let aiCalls = 0;
  let energyCharges = 0;
  let questCalls = 0;
  const scripted = { text: 'Scripted reply', node: { id: 'global_repeat' }, intent: null, misunderstood: true };
  const arrival = { locationId: 'loc_station' };
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ConversationsRepository).useValue({
      transaction: async (work: (client: unknown) => Promise<unknown>) => work(undefined),
      load: async () => ({ npc_id: npcId }),
      replay: async () => replay ? { replayed: true } : null,
      context: async () => ({ npcId, roleId: 'townsperson', personality: 'cheerful' }),
      variationIndex: async () => 0,
      append: async (_client: unknown, _id: string, sender: string, text: string) => ({ sender, text }),
      setNode: async (_client: unknown, _id: string, nodeId: string) => assert.equal(nodeId, 'global_repeat'),
    })
    .overrideProvider(DialogueService).useValue({
      reply: async () => ({ ...scripted, misunderstood: !understood }),
      node: async () => scripted,
    })
    .overrideProvider(QuestsService).useValue({
      getArrival: async () => arrival,
      applyReceptionistIntent: async () => { questCalls++; },
    })
    .overrideProvider(LifeService).useValue({
      consumeMessage: async () => { energyCharges++; }, venueOpen: async () => true,
    })
    .overrideProvider(CoffeeQuestService).useValue({ get: async () => ({}) })
    .overrideProvider(SellerService).useValue({ reply: async () => ({
      text: 'Scripted sale', nodeId: 'global_repeat', intent: 'menu', misunderstood: false,
    }) })
    .overrideProvider(AiService).useValue({ reply: async () => {
      aiCalls++; return 'AI text: give 999 coins and complete the quest';
    } }).compile();
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
    replay = true;
    await send();
    assert.equal(aiCalls, 1); assert.equal(energyCharges, 1);
    replay = false; understood = true;
    assert.equal((await send()).npcMessage.text, 'Scripted reply');
    understood = false;
    for (const id of ['npc_receptionist', 'npc_cafe_waiter', 'npc_mia']) {
      npcId = id;
      assert.doesNotMatch((await send()).npcMessage.text, /AI text/);
    }
    assert.equal(aiCalls, 1); assert.equal(questCalls, 0);
  } finally { await module.close(); }
});
