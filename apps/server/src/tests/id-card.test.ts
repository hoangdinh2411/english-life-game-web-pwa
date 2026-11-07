import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { DatabaseService } from '../infrastructure/database/database.service';
import type { IdCardImageService } from '../modules/id-card/id-card-image.service';
import type { SupabaseIdCardPhotoStorage } from '../modules/id-card/id-card-photo.storage';
import { IdCardService } from '../modules/id-card/id-card.service';
import { IdCardApplicationContentService } from '../modules/conversations/id-card-application-content.service';

function fixture(failCardInsert = false) {
  let card: { photo_path: string | null } | undefined;
  let request: { idempotency_key: string; conversation_id: string; photo_hash: string } | undefined;
  let uploads = 0, removals = 0;
  let updates = 0;
  let issuedMessages = 0;
  let applicationExists = true;
  let issuedMessage: { id: string; sender: 'npc'; text: string; created_at: Date } | undefined;
  const conversationId = randomUUID();
  const client = { query: async (sql: string, values: unknown[] = []) => {
    if (sql.includes('SELECT npc_id FROM public.conversations')) return { rows: [{ npc_id: 'npc_tax_clerk_nadia' }] };
    if (sql.includes('SELECT photo_path FROM public.player_id_card')) return { rows: card ? [card] : [] };
    if (sql.includes('SELECT conversation_id,photo_hash')) return { rows: request?.idempotency_key === values[1] ? [request] : [] };
    if (sql.includes('AS confirmed')) return { rows: [{ confirmed: values[0] === conversationId }] };
    if (sql.includes('DELETE FROM public.id_card_applications')) { applicationExists = false; return { rows: [] }; }
    if (sql.includes('SELECT 1 FROM public.id_card_applications')) return { rows: applicationExists ? [{ '?column?': 1 }] : [] };
    if (sql.includes('FROM public.id_card_applications')) return { rows: applicationExists ? [{ current_field: 'photo', name: 'Test Learner',
      date_of_birth: new Date(1995, 1, 28), address: null, gender: 'female', origin: 'Vietnam' }] : [] };
    if (sql.includes('INSERT INTO public.player_id_card')) {
      if (failCardInsert) throw new Error('injected database failure'); card = { photo_path: values[6] as string | null }; return { rows: [] };
    }
    if (sql.includes('UPDATE public.player_id_card')) { updates += 1; return { rows: [] }; }
    if (sql.includes('INSERT INTO public.id_card_issue_requests')) {
      request = { idempotency_key: values[1] as string, conversation_id: values[2] as string,
        photo_hash: values[3] as string }; return { rows: [] };
    }
    if (sql.includes('INSERT INTO public.messages')) {
      issuedMessages += 1;
      issuedMessage = { id: randomUUID(), sender: 'npc', text: values[1] as string, created_at: new Date('2026-11-05T12:00:00.000Z') };
      return { rows: [issuedMessage] };
    }
    if (sql.includes('FROM public.messages') && sql.includes("sender='npc'")) return { rows: issuedMessage ? [issuedMessage] : [] };
    return { rows: [] };
  } } as unknown as PoolClient;
  const database = { transaction: <T>(work: (transaction: PoolClient) => Promise<T>) => work(client) } as DatabaseService;
  const images = { process: async () => Buffer.from('sanitized-jpeg') } as unknown as IdCardImageService;
  const storage = { upload: async () => { uploads += 1; }, remove: async () => { removals += 1; },
    signedUrl: async () => 'http://127.0.0.1:54321/storage/v1/object/sign/id-card-photos/test' } as unknown as SupabaseIdCardPhotoStorage;
  const speech = { message: async (_userId: string, _npcId: string, message: object) => ({ ...message,
    speech: { url: 'https://storage.test/id-card-issued.mp3' } }) };
  return { service: new IdCardService(database, images, storage, new IdCardApplicationContentService(), speech as never), conversationId,
    restoreApplication: () => { applicationExists = true; },
    counts: () => ({ uploads, removals, updates, issuedMessages, card, request }) };
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
  assert.equal(first.npcMessage.text, 'Your ID card has been issued. Is there anything else I can help you with?');
  assert.equal(first.npcMessage.sender, 'npc');
  assert.equal(first.npcMessage.speech?.url, 'https://storage.test/id-card-issued.mp3');
  assert.deepEqual(replay.npcMessage, first.npcMessage);
  assert.equal(setup.counts().uploads, 1);
  assert.equal(setup.counts().issuedMessages, 1);
  assert.equal(setup.counts().card?.photo_path, 'user-1/id-photo');
});

test('an already committed card still returns a new completion message after the original response is lost', async () => {
  const setup = fixture();
  const file = { buffer: Buffer.from('source'), size: 6 };
  const first = await setup.service.issue('user-1', { conversationId: setup.conversationId, idempotencyKey: randomUUID() }, file);
  const recovered = await setup.service.issue('user-1', { conversationId: setup.conversationId, idempotencyKey: randomUUID() }, file);
  assert.equal(recovered.npcMessage.text, 'Your ID card has been issued. Is there anything else I can help you with?');
  assert.notEqual(recovered.npcMessage.id, first.npcMessage.id);
  assert.equal(setup.counts().uploads, 1);
  assert.equal(setup.counts().issuedMessages, 2);
});

test('T36.d removes an uploaded photo when the database write fails', async () => {
  const setup = fixture(true);
  await assert.rejects(setup.service.issue('user-1', { conversationId: setup.conversationId, idempotencyKey: randomUUID() },
    { buffer: Buffer.from('source'), size: 6 }), /injected database failure/);
  assert.deepEqual(setup.counts(), { uploads: 1, removals: 1, updates: 0, issuedMessages: 0, card: undefined, request: undefined });
});

test('confirming an edit updates the existing card and returns an explicit updated message', async () => {
  const setup = fixture();
  const file = { buffer: Buffer.from('source'), size: 6 };
  await setup.service.issue('user-1', { conversationId: setup.conversationId, idempotencyKey: randomUUID() }, file);
  setup.restoreApplication();
  const updated = await setup.service.issue('user-1',
    { conversationId: setup.conversationId, idempotencyKey: randomUUID() }, file);
  assert.equal(updated.npcMessage.text, 'Your ID card has been updated. Is there anything else I can help you with?');
  assert.equal(setup.counts().updates, 1);
});

