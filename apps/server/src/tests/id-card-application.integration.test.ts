import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { Pool } from 'pg';
import type { ArrivalState } from '@life-abroad/shared';
import { IdCardApplicationContentService } from '../modules/conversations/id-card-application-content.service';
import { IdCardApplicationService } from '../modules/conversations/id-card-application.service';

const arrival: ArrivalState = {
  questId: 'q_station_arrival', status: 'done', currentStepId: null,
  ticket: { issued: true, used: true }, canEnterTownStreet: true, rewardsGranted: true,
  locationId: 'loc_tax_office',
};

test('T36.c keeps ordered answers in server state, resumes, and maps approved address phrases to null', async () => {
  const databaseUrl = process.env.DATABASE_URL ?? '';
  const email = process.env.TEST_ACCOUNT_EMAIL ?? '';
  assert.ok(databaseUrl, 'DATABASE_URL is required');
  assert.ok(email, 'TEST_ACCOUNT_EMAIL is required');
  const database = new Pool({ connectionString: databaseUrl });
  const client = await database.connect();
  const service = new IdCardApplicationService(new IdCardApplicationContentService());
  try {
    await client.query('BEGIN');
    const user = await client.query<{ id: string }>('SELECT id FROM auth.users WHERE email=$1', [email]);
    assert.equal(user.rowCount, 1, 'the supplied test account must already exist');
    const userId = user.rows[0]!.id;
    await client.query('DELETE FROM public.id_card_applications WHERE user_id=$1', [userId]);

    assert.equal((await service.reply(client, userId, 'I need an ID card', arrival))?.nodeId,
      'tax_office_application_name');
    assert.match((await service.reply(client, userId, '', arrival))!.responseText, /name between 1 and 60/i);
    assert.match((await service.reply(client, userId, 'Test Learner', arrival))!.responseText, /date of birth/i);
    assert.match((await service.reply(client, userId, '2099-01-01', arrival))!.responseText, /real date/i);
    assert.match((await service.reply(client, userId, '1995-02-28', arrival))!.responseText, /address/i);
    assert.match(await service.opening(client, userId) ?? '', /address/i, 'a reopened conversation resumes the saved field');
    assert.match((await service.reply(client, userId, '12 Maple Street', arrival))!.responseText, /gender/i);
    assert.match((await service.reply(client, userId, 'I am female', arrival))!.responseText, /come from/i);
    assert.match((await service.reply(client, userId, 'Vietnam', arrival))!.responseText, /photo/i);

    const saved = await client.query<{ current_field: string; name: string; date_of_birth: string;
      address: string | null; gender: string; origin: string }>(`SELECT current_field,name,date_of_birth,address,gender,origin
      FROM (SELECT current_field,name,date_of_birth::text,address,gender,origin
        FROM public.id_card_applications WHERE user_id=$1) application`, [userId]);
    assert.equal(saved.rows[0]!.current_field, 'photo');
    assert.deepEqual({ name: saved.rows[0]!.name, address: saved.rows[0]!.address,
      gender: saved.rows[0]!.gender, origin: saved.rows[0]!.origin },
    { name: 'Test Learner', address: '12 Maple Street', gender: 'female', origin: 'Vietnam' });
    assert.equal(saved.rows[0]!.date_of_birth, '1995-02-28');
    const review = await service.review(client, userId, 'character picture', arrival);
    assert.match(review.responseText, /Name: Test Learner/);
    assert.match(review.responseText, /Date of birth: 1995-02-28/);
    assert.match(review.responseText, /Address: 12 Maple Street/);
    assert.match(review.responseText, /Gender: female/);
    assert.match(review.responseText, /Where you come from: Vietnam/);
    assert.match(review.responseText, /Photo: character picture\. Is this correct\?$/);
    assert.match((await service.reply(client, userId, 'no', arrival))!.responseText, /Which answer/i);
    assert.match((await service.reply(client, userId, 'address', arrival))!.responseText, /What is your address/i);

    const phrases = ["I don't have one yet", 'later', "I'll update it later", 'not now', 'skip'];
    for (const phrase of phrases) {
      await client.query('DELETE FROM public.id_card_applications WHERE user_id=$1', [userId]);
      for (const answer of ['I need an ID card', 'Test Learner', '1995-02-28', phrase]) {
        await service.reply(client, userId, answer, arrival);
      }
      const address = await client.query<{ address: string | null; current_field: string }>(
        'SELECT address,current_field FROM public.id_card_applications WHERE user_id=$1', [userId]);
      assert.deepEqual(address.rows[0], { address: null, current_field: 'gender' }, phrase);
    }

    await service.clear(client, userId);
    assert.equal(await service.opening(client, userId), null, 'cancelling or issuing removes pending answers');
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await database.end();
  }
});

