import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { createConversationController } from '../src/features/dialogue/conversation-controller.ts';

const quest = {questId:'q_order_coffee',title:'Your First Coffee',status:'active',currentStepId:'coffee_pay',objective:'Confirm and pay for your drink',available:true,rewardsGranted:false,rewards:{xp:20,coins:5}};
const done = {...quest,status:'done',currentStepId:null,objective:null,rewardsGranted:true};
const arrival = {questId:'q_station_arrival',status:'done',currentStepId:null,ticket:{issued:true,used:true},canEnterTownStreet:true,locationId:'loc_town_street',rewardsGranted:true};

test('shared controller uses authoritative coffee completion returned by the message request', async () => {
  const controller = createConversationController({load:async()=>arrival,start:async()=>({id:'session',npcId:'npc_mia',arrival,messages:[],coffeeQuest:quest}),
    send:async()=>({arrival,coffeeQuest:done,playerMessage:{id:'player',sender:'player',text:'Confirm'},npcMessage:{id:'npc',sender:'npc',text:'Paid'}})});
  await controller.load(); await controller.start(); await controller.send('Confirm');
  assert.deepEqual(controller.getSnapshot().conversation.coffeeQuest,done);
});

const server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' });
try {
  const {CoffeeQuestToast,shouldShowCoffeeQuestToast}=await server.ssrLoadModule('/src/features/shops/CoffeeQuest.tsx');
  test('coffee quest completion appears as a toast without showing quest hints', () => {
    const render=state=>renderToStaticMarkup(createElement(CoffeeQuestToast,{quest:state,onDismiss:()=>{}}));
    const html=render(done);
    assert.match(html,/Your First Coffee/);
    assert.match(html,/Quest complete/);
    assert.match(html,/20 XP and \$5/);
    assert.doesNotMatch(html,/Confirm and pay|Welcome to Maplewood/);
    assert.equal(shouldShowCoffeeQuestToast(quest,done),true);
    assert.equal(shouldShowCoffeeQuestToast(done,done),false);
    assert.equal(shouldShowCoffeeQuestToast(quest,quest),false);
  });
} finally {await server.close();}
