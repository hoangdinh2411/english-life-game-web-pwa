import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { recordedVoiceManifestSchema } from '../packages/shared/dist/index.js';
import { streetVoiceLines } from './street-voice-lines.mjs';

const directory = fileURLToPath(new URL('../local-assets/maps/loc_town_street/audio/', import.meta.url));
const manifest = recordedVoiceManifestSchema.parse(JSON.parse(await readFile(join(directory, 'street-voices.json'), 'utf8')));
const expected = await streetVoiceLines();
assert.deepEqual(manifest.clips, expected.map(({ key, text, gender }) => ({ key, text, gender })));
const require = createRequire(import.meta.url);
const ffmpeg = process.env.FFMPEG_PATH ?? join(dirname(require.resolve('@ffmpeg-installer/win32-x64/package.json')), 'ffmpeg.exe');
let peak = 0, bytes = 0, duration = 0;
for (const clip of manifest.clips) {
  const file = join(directory, `${clip.key}.mp3`);
  bytes += (await stat(file)).size;
  const result = spawnSync(ffmpeg, ['-i', file, '-f', 'f32le', '-ac', '1', '-ar', '24000', 'pipe:1'], { windowsHide: true, maxBuffer: 16777216 });
  assert.equal(result.status, 0, `${clip.key} must decode`);
  const data = result.stdout;
  assert.ok(data.length > 24000, `${clip.key} must contain spoken audio`);
  let power = 0;
  for (let offset = 0; offset < data.length; offset += 4) {
    const sample = data.readFloatLE(offset);
    assert.ok(Number.isFinite(sample) && Math.abs(sample) <= 1, `${clip.key} contains invalid/clipped samples`);
    peak = Math.max(peak, Math.abs(sample)); power += sample * sample;
  }
  assert.ok(Math.sqrt(power / (data.length / 4)) > 0.001, `${clip.key} must not be silent`);
  duration += data.length / 4 / 24000;
}
assert.ok(!(await readdir(directory)).some(file => file.endsWith('.wav')), 'Temporary WAVs must be removed');
console.log(JSON.stringify({ recordings: manifest.clips.length, bytes, seconds: Math.round(duration), peak, decode: 'pass', finiteSamples: 'pass', silence: 'pass', clipping: 'none' }));

if (process.argv.includes('--uploaded')) {
  await import('../apps/server/scripts/load-env.mjs');
  const base = process.env.CONTENT_API_URL ?? 'http://127.0.0.1:3000/api/v1';
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Local verification only');
  const response = await fetch(`${base}/content/maps/loc_town_street`);
  assert.ok(response.ok, 'Street pack must load');
  const pack = await response.json();
  const remoteManifest = pack.assets.find(asset => asset.key === 'street-voices' && asset.npcId === null);
  assert.ok(remoteManifest, 'Uploaded manifest must exist');
  const downloadedManifest = await fetch(remoteManifest.url);
  assert.ok(downloadedManifest.ok);
  assert.deepEqual(await downloadedManifest.json(), manifest);
  const digest = bytes => createHash('sha256').update(bytes).digest('hex');
  for (const clip of expected) {
    const asset = pack.assets.find(asset => asset.key === clip.key && asset.npcId === null && asset.type === 'audio');
    assert.ok(asset, `Missing uploaded clip ${clip.key}`);
    const remote = await fetch(asset.url);
    assert.ok(remote.ok, `Download failed: ${clip.key}`);
    assert.equal(digest(new Uint8Array(await remote.arrayBuffer())), digest(await readFile(join(directory, `${clip.key}.mp3`))), `Uploaded bytes differ: ${clip.key}`);
  }
  // Inventory all versions, including assets hidden by the latest-version API.
  const databaseUrl = new URL(process.env.DATABASE_URL ?? '');
  assert.ok(['localhost', '127.0.0.1'].includes(databaseUrl.hostname), 'Local database only');
  const { Pool } = createRequire(new URL('../apps/server/package.json', import.meta.url))('pg');
  const pool = new Pool({ connectionString: databaseUrl.toString() });
  try {
    const result = await pool.query("SELECT key,type,version,path FROM assets WHERE map_id=$1 AND (type='audio' OR key='street-voices') ORDER BY key,version", ['loc_town_street']);
    const active = new Set([...expected.map(clip => clip.key), 'street-voices']);
    const obsolete = result.rows.filter(row => !active.has(row.key) || !pack.assets.some(asset => asset.key === row.key && asset.version === row.version));
    console.log(JSON.stringify({ uploadedClipsVerified: expected.length, databaseVoiceRows: result.rowCount, obsoleteVoiceAssets: obsolete }));
  } finally { await pool.end(); }
}
