import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { createConversationController } from '../src/features/dialogue/conversation-controller.ts';

const quest = {questId:'q_order_coffee',title:'Your First Coffee',status:'active',currentStepId:'coffee_pay',objective:'Confirm and pay for your drink',available:true,rewardsGranted:false,rewards:{xp:20,coins:5}};
const done = {...quest,status:'done',currentStepId:null,objective:null,rewardsGranted:true};
const arrival = {questId:'q_station_arrival',status:'done',currentStepId:null,ticket:{issued:true,used:true},canEnterTownStreet:true,locationId:'loc_town_street',rewardsGranted:true};

test('shared controller refreshes saved coffee completion instead of stale replay metadata', async () => {
  const controller = createConversationController({load:async()=>arrival,start:async()=>({id:'session',npcId:'npc_mia',arrival,messages:[],coffeeQuest:quest}),
    send:async()=>({arrival,coffeeQuest:quest,playerMessage:{id:'player',sender:'player',text:'Confirm'},npcMessage:{id:'npc',sender:'npc',text:'Paid'}}),
    read:async()=>({id:'session',npcId:'npc_mia',arrival,messages:[],coffeeQuest:done})});
  await controller.load(); await controller.start(); await controller.send('Confirm');
  assert.deepEqual(controller.getSnapshot().conversation.coffeeQuest,done);
});

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const {CoffeeQuest}=await server.ssrLoadModule('/src/features/shops/CoffeeQuest.tsx');
  test('coffee quest renders saved objective, prerequisite and one-time receipt', () => {
    const render=state=>renderToStaticMarkup(createElement(CoffeeQuest,{quest:state}));
    assert.match(render(quest),/Confirm and pay/);
    assert.match(render({...quest,available:false}),/Welcome to Maplewood/);
    assert.match(render(done),/Quest complete/);
    assert.match(render(done),/20 XP and \$5/);
    assert.match(render(done),/received once/);
  });
} finally {await server.close();}
