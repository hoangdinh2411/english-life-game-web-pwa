import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

test('station audio uses named female/male pairs listed in the dialogue manifest', async () => {
  const root = new URL('../assets/audio/station/', import.meta.url);
  const clips = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
  assert.equal(clips.length % 2, 0);
  const pairs = new Map();
  for (const clip of clips) {
    assert.match(clip.file, /^line-\d+-\w+\.mp3$/);
    assert.equal(clip.gender === 'female' ? clip.voice : clip.gender === 'male' ? clip.voice : '', clip.gender === 'female' ? 'af_heart' : 'am_michael');
    assert.ok((await stat(new URL(clip.file, root))).size > 1000);
    const pair = pairs.get(clip.id) ?? new Map();
    pair.set(clip.gender, clip.text);
    pairs.set(clip.id, pair);
  }
  for (const pair of pairs.values()) assert.deepEqual([...pair.keys()].sort(), ['female', 'male']);
  for (const pair of pairs.values()) assert.equal(pair.get('female'), pair.get('male'));
});
