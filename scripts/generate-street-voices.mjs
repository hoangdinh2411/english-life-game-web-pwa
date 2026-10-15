/* global AbortSignal, Blob, FormData */
import { access, mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { KokoroTTS } from 'kokoro-js';
import { recordedVoiceManifestSchema } from '../packages/shared/dist/index.js';
import { streetVoiceLines } from './street-voice-lines.mjs';

const directory = fileURLToPath(new URL('../local-assets/maps/loc_town_street/audio/', import.meta.url));
await mkdir(directory, { recursive: true });
const clips = await streetVoiceLines();
const require = createRequire(import.meta.url);
const ffmpeg = process.env.FFMPEG_PATH ?? join(dirname(require.resolve('@ffmpeg-installer/win32-x64/package.json')), 'ffmpeg.exe');
let tts;
for (const [index, clip] of clips.entries()) {
  const output = join(directory, `${clip.key}.mp3`);
  try { await access(output); continue; } catch { /* Generate only missing immutable clips. */ }
  tts ??= await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
    dtype: 'q8', device: 'cpu', cache_dir: fileURLToPath(new URL('../.voice-cache/', import.meta.url)),
  });
  console.log(`Generating street voice ${index + 1}/${clips.length}: ${clip.gender}`);
  const wave = join(directory, `${clip.key}.wav`);
  const audio = await tts.generate(clip.text, { voice: clip.voice, speed: 0.95 });
  await audio.save(wave);
  execFileSync(ffmpeg, ['-y', '-i', wave, '-af', 'alimiter=limit=0.95:level=false', '-ar', '24000', '-ac', '1', '-b:a', '96k', output],
    { stdio: 'ignore', windowsHide: true });
  await unlink(wave);
}
const manifest = recordedVoiceManifestSchema.parse({ version: 1, clips: clips.map(({ key, text, gender }) => ({ key, text, gender })) });
await writeFile(join(directory, 'street-voices.json'), JSON.stringify(manifest, null, 2) + '\n');
// This directory and filename prefix are exclusively owned by this generator.
const retained = new Set(clips.map(clip => `${clip.key}.mp3`));
for (const file of await readdir(directory)) {
  if (/^street-voice-[a-f0-9]{16}\.(mp3|wav)$/.test(file) && !retained.has(file)) await unlink(join(directory, file));
}
console.log(`Ready: ${clips.length} Kokoro recordings in ${directory}`);

if (process.argv.includes('--upload')) {
  await import('../apps/server/scripts/load-env.mjs');
  const base = process.env.CONTENT_API_URL ?? 'http://127.0.0.1:3000/api/v1';
  if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('This command only updates the local game.');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error('Local content upload key is unavailable.');
  const packResponse = await fetch(`${base}/content/maps/loc_town_street`);
  if (!packResponse.ok) throw new Error('Existing Town Street map is unavailable.');
  const pack = await packResponse.json();
  for (const [index, asset] of [...clips.map(clip => ({ key: clip.key, type: 'audio', mime: 'audio/mpeg', extension: 'mp3' })),
    { key: 'street-voices', type: 'json', mime: 'application/json', extension: 'json' }].entries()) {
    const previous = pack.assets.find(candidate => candidate.key === asset.key && candidate.npcId === null);
    // Hashed audio keys are immutable; the mutable manifest gets a new version.
    if (previous && asset.type === 'audio') continue;
    if (previous && asset.type === 'json') {
      const response = await fetch(previous.url);
      if (response.ok && JSON.stringify(await response.json()) === JSON.stringify(manifest)) continue;
    }
    const form = new FormData();
    form.set('mapId', 'loc_town_street'); form.set('type', asset.type); form.set('version', String((previous?.version ?? 0) + 1));
    form.set('file', new Blob([await readFile(join(directory, `${asset.key}.${asset.extension}`))], { type: asset.mime }), `${asset.key}.${asset.extension}`);
    const response = await fetch(`${base}/content/assets/upload`, { method: 'POST', headers: { Authorization: `Bearer ${serviceKey}` }, body: form, signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`Street voice upload failed (${response.status}), generated files retained.`);
    console.log(`Uploaded ${index + 1}/${clips.length + 1}`);
  }
  console.log('Town Street voice assets registered in the local database and Storage.');
}
