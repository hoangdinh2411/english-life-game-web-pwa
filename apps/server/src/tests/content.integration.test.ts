import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { readdir } from 'node:fs/promises';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module';
import { mapPackSchema } from '@life-abroad/shared';

test('T14 generated files remain in the local asset folder after upload, and immutable retries resolve through metadata', async () => {
  const target = new URL(process.env.SUPABASE_URL ?? '');
  assert.ok(['127.0.0.1', 'localhost'].includes(target.hostname));
  assert.equal(target.port, '55421');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert.ok(key, 'Local service key is required');
  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix('api/v1');
  try {
    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api/v1`;
    // Spawn asynchronously: the API in this test process must keep servicing requests.
    const { spawn } = await import('node:child_process');
    const invoke = () => new Promise<string>((resolveRun, reject) => {
      const child = spawn(process.execPath, [resolve('../../scripts/upload-map-assets.mjs'), '--target', 'local'], {
        env: { ...process.env, CONTENT_API_URL: base }, stdio: ['ignore', 'pipe', 'pipe'],
      });
      let output = '';
      child.stdout.on('data', (data: Buffer) => { output += data.toString(); });
      child.stderr.on('data', () => {}); // Do not print credentials or provider diagnostics.
      child.on('error', reject);
      child.on('exit', (code) => code === 0 ? resolveRun(output) : reject(new Error(`Upload script exited ${code}`)));
    });
    const first: unknown = JSON.parse(await invoke());
    const second: unknown = JSON.parse(await invoke());
    assert.deepEqual(first, second, 'Identical retries must keep immutable paths');
    assert.deepEqual((await readdir(resolve('../../local-assets/maps/loc_town_street'))).sort(), ['animations.json', 'background.svg', 'player.svg']);
    const response = await fetch(`${base}/content/maps/loc_town_street`);
    assert.equal(response.status, 200);
    const pack = mapPackSchema.parse(await response.json());
    assert.equal(pack.assets.length, 3);
    for (const asset of pack.assets) {
      assert.ok(asset.url.includes('/storage/v1/object/public/game-assets/'));
      const file = await fetch(asset.url);
      assert.equal(file.status, 200);
      assert.match(file.headers.get('cache-control') ?? '', /max-age=31536000/);
      assert.equal((await file.arrayBuffer()).byteLength, asset.bytes);
    }
    const send = (mapId: string, type: string, data: string) => {
      const form = new FormData();
      form.set('file', new Blob([data], { type: 'image/svg+xml' }), 'background.svg');
      form.set('mapId', mapId); form.set('type', type); form.set('version', '1');
      return fetch(`${base}/content/assets/upload`, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form });
    };
    assert.equal((await send('loc_town_street', 'map', '<svg/>')).status, 409);
    assert.equal((await send('loc_station', 'map', '<svg/>')).status, 400);
    // Client roles cannot enumerate metadata through direct database access.
    const permission = spawnSync(process.execPath, ['-e', `const {Pool}=require('pg'); const p=new Pool({connectionString:process.env.DATABASE_URL}); (async()=>{try{await p.query('BEGIN');await p.query('SET LOCAL ROLE authenticated');await p.query('SELECT * FROM assets');process.exitCode=1;}catch(e){if(e.code!=='42501')process.exitCode=1;}finally{await p.query('ROLLBACK');await p.end();}})();`], { env: process.env });
    assert.equal(permission.status, 0);
  } finally { await app.close(); }
});
