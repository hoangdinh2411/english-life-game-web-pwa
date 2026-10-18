import assert from 'node:assert/strict';
import test from 'node:test';
import { preparePack } from '../src/features/assets/phaser-pack.ts';

test('shop packs require three NPCs and all directional walking frames', async () => {
  const animations = { animations: Array.from({length:4},(_,row)=>({key:`walk-${row}`,texture:'player',frames:[row*4,row*4+1,row*4+2,row*4+3],frameRate:7,repeat:-1})) };
  const ids = ['npc_mia','npc_cafe_waiter','npc_cafe_customer'];
  const actors = { actors: ids.map(npcId=>({npcId,texture:`npc-${npcId}`,frame:'walk',x:800,y:400,scale:0.6})) };
  const assets = [['background','map'],['player','spritesheet'],['animations','animation'],['actors','json'],...ids.map(id=>[`npc-${id}`,'image'])].map(([key,type])=>({key,type,version:3,npcId:null}));
  const frames = new Set(['walk', ...Array.from({length:16},(_,index)=>`walk-${Math.floor(index/4)}-${index%4}`)]);
  const scene = { cache:{json:{get:key=>key.includes(':actors:')?actors:animations}}, textures:{get:key=>({has:frame=>key.includes(':player:')||frames.has(frame)})},anims:{create:()=>{}} };
  assert.equal(preparePack(scene,{mapId:'loc_cafe',assets}).actors.length,3);
  assert.throws(()=>preparePack(scene,{mapId:'loc_cafe',assets:assets.filter(a=>a.key!=='actors')}),/NPC assets are missing/);
  frames.delete('walk-2-3');
  assert.throws(()=>preparePack(scene,{mapId:'loc_cafe',assets}),/walking frames are missing/);
});
