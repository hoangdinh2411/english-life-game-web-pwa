import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { DatabaseService } from '../infrastructure/database/database.service';
import type { IdCardImageService } from '../modules/id-card/id-card-image.service';
import type { SupabaseIdCardPhotoStorage } from '../modules/id-card/id-card-photo.storage';
import { IdCardService } from '../modules/id-card/id-card.service';
import { IdCardApplicationContentService } from '../modules/conversations/id-card-application-content.service';
import { formatIdCardNumber } from '@life-abroad/shared';
import { generateIdCardNumber } from '../modules/id-card/id-card-number';

function fixture(failCardInsert = false) {
  let card: { photo_path: string | null; number: string } | undefined;
  let request: { idempotency_key: string; conversation_id: string; photo_hash: string } | undefined;
  let uploads = 0, removals = 0;
  let updates = 0;
  let issuedMessages = 0;
  let applicationExists = true;
  let issuedMessage: { id: string; sender: 'npc'; text: string; created_at: Date } | undefined;
  let forcedCollisions = 0;
  let numberChecks = 0;
  const conversationId = randomUUID();
  const client = { query: async (sql: string, values: unknown[] = []) => {
    if (sql.includes('SELECT npc_id FROM public.conversations')) return { rows: [{ npc_id: 'npc_tax_clerk_nadia' }] };
    if (sql.includes('FROM public.player_id_card WHERE user_id=$1')) return { rows: card ? [card] : [] };
    if (sql.includes('SELECT 1 FROM public.player_id_card WHERE number=$1')) {
      numberChecks += 1;
      return { rows: numberChecks <= forcedCollisions ? [{ '?column?': 1 }] : [] };
    }
    if (sql.includes('SELECT conversation_id,photo_hash')) return { rows: request?.idempotency_key === values[1] ? [request] : [] };
    if (sql.includes('AS confirmed')) return { rows: [{ confirmed: values[0] === conversationId }] };
    if (sql.includes('DELETE FROM public.id_card_applications')) { applicationExists = false; return { rows: [] }; }
    if (sql.includes('SELECT 1 FROM public.id_card_applications')) return { rows: applicationExists ? [{ '?column?': 1 }] : [] };
    if (sql.includes('FROM public.id_card_applications')) return { rows: applicationExists ? [{ current_field: 'photo', name: 'Test Learner',
      date_of_birth: new Date('1995-02-28T00:00:00.000Z'), address: null, gender: 'female', origin: 'Vietnam' }] : [] };
    if (sql.includes('INSERT INTO public.player_id_card')) {
      if (failCardInsert) throw new Error('injected database failure'); card = { number: values[1] as string, photo_path: values[7] as string | null }; return { rows: [] };
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
    forceCollisions: (count: number) => { forcedCollisions = count; },
    counts: () => ({ uploads, removals, updates, issuedMessages, numberChecks, card, request }) };
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

test('T36.e generates date-prefixed numbers with parity and shared display formatting', () => {
  const birthDate = new Date('1995-02-28T00:00:00.000Z');
  const localMidnight = new Date(1992, 10, 24);
  const male = generateIdCardNumber(birthDate, 'male');
  const female = generateIdCardNumber(birthDate, 'female');
  const localNumber = generateIdCardNumber(localMidnight, 'male');
  assert.match(male, /^19950228\d{4}$/);
  assert.match(female, /^19950228\d{4}$/);
  assert.match(localNumber, /^19921124\d{4}$/);
  assert.equal(Number(male.at(-1)) % 2, 1);
  assert.equal(Number(female.at(-1)) % 2, 0);
  assert.equal(formatIdCardNumber('199502280007'), '19950228-0007');
  assert.throws(() => formatIdCardNumber('199502287'), /exactly 12 digits/);
});

test('T36.e retries number collisions, stores text digits and preserves the assigned number on replay', async () => {
  const setup = fixture();
  setup.forceCollisions(3);
  const body = { conversationId: setup.conversationId, idempotencyKey: randomUUID() };
  const first = await setup.service.issue('user-1', body, undefined);
  const firstNumber = setup.counts().card?.number;
  assert.match(firstNumber ?? '', /^19950228\d{4}$/);
  assert.equal(Number(firstNumber?.at(-1)) % 2, 0);
  assert.equal(setup.counts().numberChecks, 4);
  const replay = await setup.service.issue('user-1', body, undefined);
  assert.equal(setup.counts().card?.number, firstNumber);
  assert.deepEqual(replay, first);
});

test('T36.e reports a friendly retry after twenty number collisions', async () => {
  const setup = fixture();
  setup.forceCollisions(20);
  await assert.rejects(setup.service.issue('user-1',
    { conversationId: setup.conversationId, idempotencyKey: randomUUID() }, undefined), /Please try again later/);
  assert.equal(setup.counts().numberChecks, 20);
  assert.equal(setup.counts().card, undefined);
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
  assert.deepEqual(setup.counts(), { uploads: 1, removals: 1, updates: 0, issuedMessages: 0, numberChecks: 1, card: undefined, request: undefined });
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

test('T36.f reads the owner card with a formatted number and signed photo URL', async () => {
  const queries: Array<{ sql: string; values: unknown[] }> = [];
  const database = {
    query: async (sql: string, values: unknown[] = []) => {
      queries.push({ sql, values });
      if (sql.includes('SELECT number,full_name')) {
        return { rows: [{
          number: '199502280007', full_name: 'Test Learner', birth_date: new Date('1995-02-28T00:00:00.000Z'),
          address: null, gender: 'female', origin: 'Vietnam', photo_path: 'user-1/id-photo',
          issued_at: new Date('2026-11-05T12:00:00.000Z'), updated_at: new Date('2026-11-05T12:00:00.000Z'),
        }], rowCount: 1 };
      }
      if (sql.includes('SELECT 1 FROM public.player_id_card')) return { rows: [{ '?column?': 1 }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    },
  } as unknown as DatabaseService;
  const storage = { signedUrl: async (path: string) => `https://storage.test/${path}` } as unknown as SupabaseIdCardPhotoStorage;
  const service = new IdCardService(database, {} as IdCardImageService, storage,
    new IdCardApplicationContentService(), {} as never);

  assert.deepEqual(await service.get('user-1'), {
    number: '19950228-0007', fullName: 'Test Learner', birthDate: '1995-02-28', address: null,
    gender: 'female', origin: 'Vietnam', photoUrl: 'https://storage.test/user-1/id-photo',
    issuedAt: '2026-11-05T12:00:00.000Z', updatedAt: '2026-11-05T12:00:00.000Z',
  });
  assert.equal(await service.hasIdCard('user-1'), true);
  assert.equal(await service.hasAddress('user-1'), true);
  assert.match(queries[0]!.sql, /WHERE user_id=\$1/);
});

test('T36.f updates an address only through the internal service function', async () => {
  let updatedAddress: unknown;
  const database = {
    query: async (sql: string, values: unknown[] = []) => {
      if (sql.startsWith('UPDATE public.player_id_card')) {
        updatedAddress = values[1];
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
  } as unknown as DatabaseService;
  const service = new IdCardService(database, {} as IdCardImageService, {} as SupabaseIdCardPhotoStorage,
    new IdCardApplicationContentService(), {} as never);

  await service.setIdCardAddress('user-1', '12 Maple Street');
  assert.equal(updatedAddress, '12 Maple Street');
  await service.setIdCardAddress('user-1', '<script>');
  assert.equal(updatedAddress, '<script>');
  await service.setIdCardAddress('user-1', null);
  assert.equal(updatedAddress, null);
  await assert.rejects(service.setIdCardAddress('user-1', '   '), /plain text/);
});
