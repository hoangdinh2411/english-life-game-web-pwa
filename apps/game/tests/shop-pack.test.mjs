/* global AbortController */
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPack, preparePack } from '../src/features/assets/phaser-pack.ts';

test('shop packs require their actor manifest and all directional walking frames', async () => {
  const animations = { animations: Array.from({length:4},(_,row)=>({key:`walk-${row}`,texture:'player',frames:[row*4,row*4+1,row*4+2,row*4+3],frameRate:7,repeat:-1})) };
  const ids = ['npc_mia','npc_cafe_waiter','npc_cafe_customer'];
  const actors = { actors: ids.map(npcId=>({npcId,texture:`npc-${npcId}`,frame:'walk',x:800,y:400,scale:0.6})) };
  const assets = [['background','map'],['player','spritesheet'],['animations','animation'],['actors','json'],...ids.map(id=>[`npc-${id}`,'image'])].map(([key,type])=>({key,type,version:3,npcId:null}));
  const frames = new Set(['walk', ...Array.from({length:16},(_,index)=>`walk-${Math.floor(index/4)}-${index%4}`)]);
  const scene = { cache:{json:{get:key=>key.includes(':actors:')?actors:animations}}, textures:{get:key=>({has:frame=>key.includes(':player:')||frames.has(frame)})},anims:{create:()=>{}} };
  assert.equal(preparePack(scene,{mapId:'loc_cafe',assets}).actors.length,3);
  assert.throws(()=>preparePack(scene,{mapId:'loc_cafe',assets:assets.filter(a=>a.key!=='actors')}),/NPC assets are missing/);
  frames.delete('walk-2-3');
  assert.throws(()=>preparePack(scene,{mapId:'loc_cafe',assets}),/Required service NPC npc_mia asset is unavailable/);
});

test('a missing optional customer asset skips only that customer with a safe diagnostic', () => {
  const animations = { animations: Array.from({length:4},(_,row)=>({key:`walk-${row}`,texture:'player',frames:[row*4],frameRate:7,repeat:-1})) };
  const actors = { actors: [
    {npcId:'npc_mia',texture:'service-npc_mia',frame:'walk',x:800,y:400,scale:0.6},
    {npcId:'npc_cafe_waiter',texture:'service-npc_cafe_waiter',frame:'walk',x:900,y:400,scale:0.6},
    {npcId:'npc_cafe_customer',texture:'npc-npc_cafe_customer',frame:'walk',x:430,y:600,scale:0.6},
  ] };
  const assets = [['background','map'],['player','spritesheet'],['animations','animation'],['actors','json']]
    .map(([key,type])=>({key,type,version:1,npcId:null}));
  const frames = new Set(['walk', ...Array.from({length:16},(_,index)=>`walk-${Math.floor(index/4)}-${index%4}`)]);
  const scene = { cache:{json:{get:key=>key.includes(':actors:')?actors:animations}}, textures:{get:key=>({has:frame=>key.includes('service-')?frames.has(frame):key.includes(':player:')})},anims:{create:()=>{}} };
  const diagnostics = [];
  const result = preparePack(scene,{mapId:'loc_cafe',assets},id=>id === 'npc_cafe_customer' ? undefined : `service-${id}`,new Set(),message=>diagnostics.push(message));
  assert.deepEqual(result.actors.map(actor=>actor.npcId), ['npc_mia','npc_cafe_waiter']);
  assert.deepEqual(diagnostics, ['Optional ambient NPC asset unavailable: npc_cafe_customer at loc_cafe.']);
});

test('a missing required service definition or bundled texture fails the location', () => {
  const animations = { animations: Array.from({length:4},(_,row)=>({key:`walk-${row}`,texture:'player',frames:[row*4],frameRate:7,repeat:-1})) };
  const baseActors = [
    {npcId:'npc_mia',texture:'service-npc_mia',frame:'walk',x:800,y:400,scale:0.6},
    {npcId:'npc_cafe_waiter',texture:'service-npc_cafe_waiter',frame:'walk',x:900,y:400,scale:0.6},
    {npcId:'npc_cafe_customer',texture:'npc-npc_cafe_customer',frame:'walk',x:430,y:600,scale:0.6},
  ];
  const assets = [['background','map'],['player','spritesheet'],['animations','animation'],['actors','json'],['npc-npc_cafe_customer','image']]
    .map(([key,type])=>({key,type,version:1,npcId:null}));
  const scene = actors => ({ cache:{json:{get:key=>key.includes(':actors:')?{actors}:animations}}, textures:{get:key=>({has:()=>!key.includes('service-npc_mia')})},anims:{create:()=>{}} });
  assert.throws(()=>preparePack(scene(baseActors.slice(1)),{mapId:'loc_cafe',assets},id=>`service-${id}`),/Required service NPC npc_mia definition is missing/);
  assert.throws(()=>preparePack(scene(baseActors),{mapId:'loc_cafe',assets},id=>`service-${id}`),/Required service NPC npc_mia asset is unavailable/);
});

test('pack loading tolerates a failed optional customer download and reports its NPC ID', async () => {
  const events = new Map();
  const diagnostics = [];
  const pack = {mapId:'loc_cafe',assets:[
    {key:'npc-npc_cafe_customer',type:'image',url:'http://fixture/customer.png',version:1,npcId:null},
  ]};
  const load = {
    on:(name,fn)=>events.set(name,fn), off:()=>{}, once:(name,fn)=>events.set(name,fn), reset:()=>{},
    image:(key)=>{ events.set('assetKey',key); }, start:()=>{ events.get('loaderror')({key:events.get('assetKey')}); events.get('complete')(); },
  };
  const unavailable = await loadPack({load},pack,()=>{},new AbortController().signal,message=>diagnostics.push(message));
  assert.deepEqual([...unavailable], ['npc_cafe_customer']);
  assert.deepEqual(diagnostics, ['Optional ambient NPC asset unavailable: npc_cafe_customer at loc_cafe.']);
});
