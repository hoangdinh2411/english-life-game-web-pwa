import assert from 'node:assert/strict';
import test from 'node:test';
import { streetAudioCatalog } from '../src/features/npcs/street-audio.ts';
import { isDeferredStreetNpcAsset } from '../src/features/assets/phaser-pack.ts';
import { streetVoiceLines } from '../../../scripts/street-voice-lines.mjs';

test('street catalogue resolves male/female recordings from the map without bundling their audio', () => {
  const assets = ['female', 'male'].map((gender, index) => ({ key: `street-voice-${index}`, type: 'audio', npcId: null, url: `https://assets.fixture/${gender}.mp3`, version: 1, bytes: 10000 }));
  const pack = { mapId: 'loc_town_street', assets };
  const manifest = { version: 1, clips: assets.map((asset, index) => ({ key: asset.key, text: 'Hello!', gender: index ? 'male' : 'female' })) };
  assert.deepEqual(streetAudioCatalog(pack, manifest), [
    { text: 'Hello!', gender: 'female', asset: 'https://assets.fixture/female.mp3' },
    { text: 'Hello!', gender: 'male', asset: 'https://assets.fixture/male.mp3' },
  ]);
  for (const asset of assets) assert.equal(isDeferredStreetNpcAsset(pack, asset), true, 'Phaser must not download all speech on map entry');
  assert.equal(isDeferredStreetNpcAsset(pack, { key: 'street-voices', type: 'json' }), true);
  assert.throws(() => streetAudioCatalog({ ...pack, assets: [] }, manifest), /missing/);
  assert.throws(() => streetAudioCatalog(pack, { version: 1, clips: [{ ...manifest.clips[0], gender: 'unknown' }] }));
});

test('Kokoro source covers opening variations, personality replies and common fallback in both street voices', async () => {
  const clips = await streetVoiceLines();
  for (const gender of ['female', 'male']) {
    assert.ok(clips.some(clip => clip.gender === gender && clip.text === 'Good day! Do you like exploring new places?'));
    assert.ok(clips.some(clip => clip.gender === gender && clip.text === 'Sorry, can you say that again?'));
  }
  assert.ok(clips.some(clip => clip.gender === 'female' && clip.text === 'I like quiet walks and a good book. What do you enjoy?'));
  assert.ok(clips.every(clip => clip.gender === 'female' ? clip.voice === 'af_heart' : clip.voice === 'am_michael'));
  assert.equal(new Set(clips.map(clip => clip.key)).size, clips.length);
  assert.ok(clips.every(clip => !/\{\w+\}/.test(clip.text)));
});
