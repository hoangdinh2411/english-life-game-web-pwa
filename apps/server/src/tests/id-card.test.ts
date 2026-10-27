import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { DatabaseService } from '../infrastructure/database/database.service';
import type { IdCardImageService } from '../modules/id-card/id-card-image.service';
import type { SupabaseIdCardPhotoStorage } from '../modules/id-card/id-card-photo.storage';
import { IdCardService } from '../modules/id-card/id-card.service';

function fixture(failCardInsert = false) {
  let card: { photo_path: string | null } | undefined;
  let request: { conversation_id: string; photo_hash: string } | undefined;
  let uploads = 0, removals = 0;
  const conversationId = randomUUID();
  const client = { query: async (sql: string, values: unknown[] = []) => {
    if (sql.includes('SELECT photo_path FROM public.player_id_card')) return { rows: card ? [card] : [] };
    if (sql.includes('SELECT conversation_id,photo_hash')) return { rows: request ? [request] : [] };
    if (sql.includes('AS confirmed')) return { rows: [{ confirmed: values[0] === conversationId }] };
    if (sql.includes('FROM public.id_card_applications')) return { rows: [{ current_field: 'photo', name: 'Test Learner',
      date_of_birth: new Date(1995, 1, 28), address: null, gender: 'female', origin: 'Vietnam' }] };
    if (sql.includes('INSERT INTO public.player_id_card')) {
      if (failCardInsert) throw new Error('injected database failure'); card = { photo_path: values[6] as string | null }; return { rows: [] };
    }
    if (sql.includes('INSERT INTO public.id_card_issue_requests')) {
      request = { conversation_id: values[2] as string, photo_hash: values[3] as string }; return { rows: [] };
    }
    return { rows: [] };
  } } as unknown as PoolClient;
  const database = { transaction: <T>(work: (transaction: PoolClient) => Promise<T>) => work(client) } as DatabaseService;
  const images = { process: async () => Buffer.from('sanitized-jpeg') } as unknown as IdCardImageService;
  const storage = { upload: async () => { uploads += 1; }, remove: async () => { removals += 1; },
    signedUrl: async () => 'http://127.0.0.1:54321/storage/v1/object/sign/id-card-photos/test' } as unknown as SupabaseIdCardPhotoStorage;
  return { service: new IdCardService(database, images, storage), conversationId,
    counts: () => ({ uploads, removals, card, request }) };
}

test('T36.d issues one card/photo and exact retries do not upload or insert again', async () => {
  const setup = fixture();
  const body = { conversationId: setup.conversationId, idempotencyKey: randomUUID() };
  const file = { buffer: Buffer.from('source'), size: 6 };
  const first = await setup.service.issue('user-1', body, file);
  const replay = await setup.service.issue('user-1', body, file);
  assert.deepEqual(first, replay);
  assert.equal(first.issued, true);
  assert.match(first.photoUrl ?? '', /\/object\/sign\/id-card-photos\//);
  assert.equal(setup.counts().uploads, 1);
  assert.equal(setup.counts().card?.photo_path, 'user-1/id-photo');
});

test('T36.d removes an uploaded photo when the database write fails', async () => {
  const setup = fixture(true);
  await assert.rejects(setup.service.issue('user-1', { conversationId: setup.conversationId, idempotencyKey: randomUUID() },
    { buffer: Buffer.from('source'), size: 6 }), /injected database failure/);
  assert.deepEqual(setup.counts(), { uploads: 1, removals: 1, card: undefined, request: undefined });
});

