import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import type { ArrivalState } from '@life-abroad/shared';
import type { PoolClient } from 'pg';
import { IdCardApplicationContentService } from '../modules/conversations/id-card-application-content.service';
import { IdCardApplicationService, type IdCardApplicationRow } from '../modules/conversations/id-card-application.service';

const arrival: ArrivalState = {
  questId: 'q_station_arrival', status: 'done', currentStepId: null,
  ticket: { issued: true, used: true }, canEnterTownStreet: true,
  rewardsGranted: true, locationId: 'loc_tax_office',
};

test('ID-card issuance requires the NPC review and branches to correction or confirmation', async () => {
  const row: IdCardApplicationRow = {
    current_field: 'photo', name: 'Test Learner', date_of_birth: '1995-02-28',
    address: null, gender: 'female', origin: 'Vietnam',
  };
  const client = {
    query: async (sql: string, values: readonly unknown[] = []) => {
      if (sql.includes('SELECT current_field')) return { rows: [{ ...row }], rowCount: 1 };
      if (sql.includes('SELECT 1 FROM public.player_id_card')) return { rows: [] };
      if (sql.includes('UPDATE public.id_card_applications SET current_field')) {
        row.current_field = String(values[1]) as IdCardApplicationRow['current_field'];
        if (sql.includes(',date_of_birth=')) row.date_of_birth = values[2] as string;
        if (sql.includes(',address=')) row.address = values[2] as string | null;
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('SET address=NULL')) {
        row.address = null;
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  } as unknown as PoolClient;
  const service = new IdCardApplicationService(new IdCardApplicationContentService());

  const premature = await service.reply(client, 'player-id', 'Yes, issue my card', arrival);
  assert.equal(premature?.metadata.idCardSubmit, undefined);
  assert.equal(row.current_field, 'photo');

  const review = await service.reply(client, 'player-id', 'Use my character picture', arrival);
  assert.equal(row.current_field, 'review');
  assert.match(review!.responseText, /Name: Test Learner/);
  assert.match(review!.responseText, /\n• Name: Test Learner/);
  assert.match(review!.responseText, /Address: Not provided/);
  assert.doesNotMatch(review!.responseText, /Photo:/);
  assert.match(review!.responseText, /change anything.*issue the ID card/i);
  assert.equal(review?.metadata.speechText, 'Would you like to change anything, or should I issue the ID card?');

  const correction = await service.reply(client, 'player-id', 'No', arrival);
  assert.equal(row.current_field, 'correction');
  assert.equal(correction?.metadata.intent, 'correct_id_card_application');

  row.current_field = 'review';
  const changeBirthDate = await service.reply(client, 'player-id', 'I want to change my date of birth', arrival);
  assert.equal(row.current_field, 'dateOfBirth');
  assert.equal(changeBirthDate?.responseText, 'No problem. What is your correct date of birth?');
  const correctedBirthDate = await service.reply(client, 'player-id', '24 November 1992', arrival);
  assert.equal(row.current_field, 'review');
  assert.match(correctedBirthDate!.responseText, /• Date of birth: 1992-11-24/);
  assert.doesNotMatch(correctedBirthDate!.responseText, /What’s your address/);

  const changePhoto = await service.reply(client, 'player-id', 'I want to change my photo', arrival);
  assert.equal(row.current_field, 'photo');
  assert.equal(changePhoto?.responseText, 'Of course. Please choose a different photo.');

  row.address = 'I dont have an address right now';
  const correctedReview = await service.reply(client, 'player-id', 'Use this photo', arrival);
  assert.equal(row.address, null);
  assert.match(correctedReview!.responseText, /• Address: Not provided/);

  row.current_field = 'address';
  row.address = 'incorrect literal';
  row.origin = null;
  const noAddress = await service.reply(client, 'player-id', 'I dont have an address right now', arrival);
  assert.equal(row.address, null);
  assert.equal(row.current_field, 'origin');
  assert.match(noAddress!.responseText, /provide an address later/i);

  row.current_field = 'review';
  row.origin = 'Vietnam';
  const confirmation = await service.reply(client, 'player-id', 'Yes, issue my card', arrival);
  assert.equal(confirmation?.metadata.idCardSubmit, true);
  assert.equal(confirmation?.metadata.intent, 'confirm_id_card_application');
});

test('an existing card rejects duplicate registration and starts only an explicit edit', async () => {
  let application: IdCardApplicationRow | null = null;
  let currentField: IdCardApplicationRow['current_field'] | null = null;
  let updatedAddress: unknown;
  const client = { query: async (sql: string, values: readonly unknown[] = []) => {
    if (sql.includes('SELECT current_field')) return { rows: application ? [{ ...application }] : [] };
    if (sql.includes('SELECT 1 FROM public.player_id_card')) return { rows: [{ '?column?': 1 }] };
    if (sql.includes('INSERT INTO public.id_card_applications')) {
      application = { current_field: String(values[1]) as IdCardApplicationRow['current_field'],
        name: 'Test Learner', date_of_birth: '1995-02-28', address: null, gender: 'female', origin: 'Vietnam' };
      currentField = application.current_field;
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes('UPDATE public.player_id_card SET address=')) { updatedAddress = values[1]; return { rows: [], rowCount: 1 }; }
    if (sql.includes('DELETE FROM public.id_card_applications')) { application = null; return { rows: [], rowCount: 1 }; }
    throw new Error(`Unexpected query: ${sql}`);
  } } as unknown as PoolClient;
  const service = new IdCardApplicationService(new IdCardApplicationContentService());

  const registration = await service.reply(client, 'player-id', 'I need an ID card', arrival);
  assert.equal(registration?.metadata.intent, 'id_card_already_issued');
  assert.equal(
    registration?.responseText,
    'You already have an ID card. Is there anything else I can help you with?',
  );
  assert.equal(currentField, null);

  const editMenu = await service.reply(client, 'player-id', 'I want to update my ID card', arrival);
  assert.equal(editMenu?.metadata.intent, 'edit_existing_id_card');
  assert.equal(
    editMenu?.responseText,
    'What would you like to change: your name, birthday, address, country, or photo?',
  );
  assert.equal(currentField, 'correction');

  application = null;
  currentField = null;
  const edit = await service.reply(client, 'player-id', 'I want to change my address', arrival);
  assert.equal(edit?.metadata.intent, 'select_id_card_correction');
  assert.match(edit!.responseText, /What address should I use/);
  assert.equal(currentField, 'address');
  const completed = await service.reply(client, 'player-id', '12 Maple Street', arrival);
  assert.equal(updatedAddress, '12 Maple Street');
  assert.equal(completed?.metadata.idCardApplicationCleared, true);
  assert.match(completed!.responseText, /updated.*anything else/i);

  application = { current_field: 'photo', name: 'Test Learner', date_of_birth: '1995-02-28',
    address: '12 Maple Street', gender: 'female', origin: 'Vietnam' };
  const photoUpdate = await service.reply(client, 'player-id', 'Use this photo', arrival);
  assert.equal(photoUpdate?.metadata.idCardSubmit, true);
  assert.equal(photoUpdate?.responseText, 'Thank you. I will update your ID card now.');
  assert.doesNotMatch(photoUpdate!.responseText, /Would you like to change anything/);
});

test('an existing card does not replace the normal Tax Office greeting', async () => {
  const client = { query: async (sql: string) => {
    if (sql.includes('SELECT current_field')) return { rows: [] };
    throw new Error(`Unexpected query: ${sql}`);
  } } as unknown as PoolClient;
  const service = new IdCardApplicationService(new IdCardApplicationContentService());
  assert.equal(await service.opening(client, 'player-id'), null);
});
