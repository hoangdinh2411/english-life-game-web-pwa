import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import sharp from 'sharp';
import { DatabaseService } from '../infrastructure/database/database.service';
import { IdCardImageService } from '../modules/id-card/id-card-image.service';
import { SupabaseIdCardPhotoStorage } from '../modules/id-card/id-card-photo.storage';
import { IdCardService } from '../modules/id-card/id-card.service';

test('T36.d real storage/database issues one private sanitized photo for the existing test account', async () => {
  const email = process.env.TEST_ACCOUNT_EMAIL ?? '';
  assert.ok(email, 'TEST_ACCOUNT_EMAIL is required');
  const config = new ConfigService(process.env);
  const databaseUrl = config.get<string>('DATABASE_URL') ?? '';
  const supabaseUrl = config.get<string>('SUPABASE_URL') ?? '';
  assert.equal(new URL(databaseUrl).hostname, '127.0.0.1');
  assert.equal(new URL(supabaseUrl).hostname, '127.0.0.1');
  const pool = new Pool({ connectionString: databaseUrl });
  const database = new DatabaseService(config);
  const storage = new SupabaseIdCardPhotoStorage(config);
  const service = new IdCardService(database, new IdCardImageService(), storage);
  const user = await pool.query<{ id: string }>('SELECT id FROM auth.users WHERE email=$1', [email]);
  assert.equal(user.rowCount, 1, 'the supplied account must already exist');
  const userId = user.rows[0]!.id;
  assert.equal((await pool.query('SELECT 1 FROM player_id_card WHERE user_id=$1', [userId])).rowCount, 0,
    'the test account must not already have a card');
  assert.equal((await pool.query('SELECT 1 FROM id_card_applications WHERE user_id=$1', [userId])).rowCount, 0,
    'the test account must not have an in-progress application');
  let conversationId = '';
  const photoPath = `${userId}/id-photo`;
  try {
    conversationId = (await pool.query<{ id: string }>(`INSERT INTO conversations (user_id,npc_id,current_node_id)
      VALUES ($1,'npc_tax_clerk_nadia','tax_office_application_photo') RETURNING id`, [userId])).rows[0]!.id;
    await pool.query(`INSERT INTO messages (conversation_id,sender,text,client_message_id,metadata)
      VALUES ($1,'npc','Thank you. I will issue your ID card now.',$2,$3)`,
    [conversationId, randomUUID(), { intent: 'confirm_id_card_application' }]);
    await pool.query(`INSERT INTO id_card_applications
      (user_id,current_field,name,date_of_birth,address,gender,origin)
      VALUES ($1,'photo','Test Learner','1995-02-28',null,'female','Vietnam')`, [userId]);
    const source = await sharp({ create: { width: 480, height: 640, channels: 3, background: '#9a7040' } })
      .withMetadata({ orientation: 6 }).jpeg().toBuffer();
    const body = { conversationId, idempotencyKey: randomUUID() };
    const first = await service.issue(userId, body, { buffer: source, size: source.length });
    const replay = await service.issue(userId, body, { buffer: source, size: source.length });
    assert.deepEqual(replay, first);
    assert.ok(first.photoUrl);
    const rows = await pool.query<{ cards: string; requests: string; applications: string }>(`SELECT
      (SELECT count(*) FROM player_id_card WHERE user_id=$1)::text AS cards,
      (SELECT count(*) FROM id_card_issue_requests WHERE user_id=$1)::text AS requests,
      (SELECT count(*) FROM id_card_applications WHERE user_id=$1)::text AS applications`, [userId]);
    assert.deepEqual(rows.rows[0], { cards: '1', requests: '1', applications: '0' });
    const object = await fetch(first.photoUrl);
    assert.equal(object.status, 200);
    const metadata = await sharp(Buffer.from(await object.arrayBuffer())).metadata();
    assert.deepEqual({ format: metadata.format, width: metadata.width, height: metadata.height,
      exif: metadata.exif, xmp: metadata.xmp }, { format: 'jpeg', width: 300, height: 400, exif: undefined, xmp: undefined });
    const unsigned = await fetch(`${supabaseUrl}/storage/v1/object/id-card-photos/${photoPath}`);
    assert.notEqual(unsigned.status, 200, 'private photo must not be readable without a signed URL');
    const token = new URL(first.photoUrl).searchParams.get('token') ?? '';
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as { exp?: number };
    assert.ok(payload.exp && payload.exp - Math.floor(Date.now() / 1000) <= 65, 'signed URL must expire in about 60 seconds');
  } finally {
    await storage.remove(photoPath).catch(() => undefined);
    await pool.query('DELETE FROM player_id_card WHERE user_id=$1', [userId]);
    await pool.query('DELETE FROM id_card_applications WHERE user_id=$1', [userId]);
    if (conversationId) await pool.query('DELETE FROM conversations WHERE id=$1', [conversationId]);
    await database.onApplicationShutdown();
    await pool.end();
  }
});

