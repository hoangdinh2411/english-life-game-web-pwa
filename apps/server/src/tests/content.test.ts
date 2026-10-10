import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../app.module';
import { ContentService } from '../modules/content/content.service';
import { assetUploadSchema } from '@life-abroad/shared';

test('upload requires the configured service key before processing file or body', async () => {
  let uploads = 0;
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ConfigService).useValue(new ConfigService({ SUPABASE_SERVICE_ROLE_KEY: 'fixture-service' }))
    .overrideProvider(ContentService).useValue({ upload: async () => { uploads++; return { path: 'fixture' }; }, map: async () => ({ mapId: 'loc_town_street', assets: [] }) }).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix('api/v1');
  try {
    await app.listen(0, '127.0.0.1');
    const url = await app.getUrl();
    for (const authorization of ['', 'Bearer user-token', 'Bearer fixture-servicf']) {
      const response = await fetch(`${url}/api/v1/content/assets/upload`, { method: 'POST', headers: { authorization } });
      assert.equal(response.status, 401);
    }
    const form = new FormData();
    form.set('file', new Blob(['{}'], { type: 'application/json' }), 'metadata.json');
    form.set('mapId', 'loc_town_street'); form.set('type', 'json'); form.set('version', '1');
    assert.equal((await fetch(`${url}/api/v1/content/assets/upload`, { method: 'POST', headers: { authorization: 'Bearer fixture-service' }, body: form })).status, 201);
    assert.equal(uploads, 1);
    assert.equal((await fetch(`${url}/api/v1/content/maps/invalid!`)).status, 400);
    assert.equal((await fetch(`${url}/api/v1/content/maps/loc_town_street`)).status, 200);
  } finally { await app.close(); }
});

test('upload rejects missing ownership, unknown fields and invalid versions', () => {
  for (const value of [{ type: 'map', version: 1 }, { mapId: '../station', type: 'map', version: 1 }, { mapId: 'loc_cafe', type: 'map', version: 0 }, { mapId: 'loc_cafe', type: 'map', version: 1, path: 'override' }]) {
    assert.equal(assetUploadSchema.safeParse(value).success, false);
  }
});
