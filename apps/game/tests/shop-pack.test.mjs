import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { preparePack } from '../src/features/assets/phaser-pack.ts';

test('shop packs require three NPCs and all directional walking frames', async () => {
  const atlas = JSON.parse(await readFile(new URL('../assets/npcs/shop-walk.json', import.meta.url)));
  const animations = { animations: Array.from({length:4},(_,row)=>({key:`walk-${row}`,texture:'player',frames:[row*4,row*4+1,row*4+2,row*4+3],frameRate:7,repeat:-1})) };
  const actors = { actors: ['cafe_seller','cafe_waiter','cafe_customer'].map(frame=>({texture:'shop-npcs',frame,x:800,y:400,scale:0.6})) };
  const assets = [['background','map'],['player','spritesheet'],['animations','animation'],['shop-npcs','image'],['actors','json']].map(([key,type])=>({key,type,version:3,npcId:null}));
  let frames = new Set(Object.keys(atlas.frames));
  const scene = { cache:{json:{get:key=>key.includes(':actors:')?actors:animations}}, textures:{get:key=>({has:frame=>key.includes(':player:')||frames.has(frame)})},anims:{create:()=>{}} };
  assert.equal(preparePack(scene,{mapId:'loc_cafe',assets}).actors.length,3);
  assert.throws(()=>preparePack(scene,{mapId:'loc_cafe',assets:assets.filter(a=>a.key!=='actors')}),/NPC assets are missing/);
  frames.delete('cafe_waiter-2-3');
  assert.throws(()=>preparePack(scene,{mapId:'loc_cafe',assets}),/walking frames are missing/);
});
