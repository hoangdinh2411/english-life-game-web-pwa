import assert from 'node:assert/strict';
import test from 'node:test';
import { PRACTICE_REMOTE_NPCS, practiceNpcAssets } from '../src/features/station/practice-assets.ts';

test('remote practice NPCs resolve only from a complete Train Station Storage pack', () => {
  const assets = [
    { key: 'backpack', type: 'image', version: 1, npcId: null },
    { key: 'backpack-atlas', type: 'json', version: 1, npcId: null },
    { key: 'backpack-portrait', type: 'image', version: 1, npcId: null },
    { key: 'suitcase', type: 'image', version: 1, npcId: null },
    { key: 'suitcase-atlas', type: 'json', version: 1, npcId: null },
    { key: 'suitcase-portrait', type: 'image', version: 1, npcId: null },
    { key: 'visitor', type: 'image', version: 1, npcId: null },
    { key: 'visitor-atlas', type: 'json', version: 1, npcId: null },
    { key: 'visitor-portrait', type: 'image', version: 1, npcId: null },
  ];
  for (const npc of PRACTICE_REMOTE_NPCS) {
    assert.deepEqual(Object.keys(practiceNpcAssets({ mapId: 'loc_station', assets }, npc)), ['image', 'atlas', 'portrait']);
    assert.throws(() => practiceNpcAssets({ mapId: 'loc_station', assets: assets.filter(asset => asset.key !== `${npc.assetKey}-portrait`) }, npc), new RegExp(`${npc.name}.*incomplete`));
    assert.throws(() => practiceNpcAssets({ mapId: 'loc_cafe', assets }, npc), /Train Station/);
  }
});
