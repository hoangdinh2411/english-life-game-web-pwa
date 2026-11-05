import assert from 'node:assert/strict';
import test from 'node:test';
import type { PoolClient } from 'pg';
import type { ArrivalState } from '@life-abroad/shared';
import { IdCardApplicationContentService } from '../modules/conversations/id-card-application-content.service';
import { IdCardApplicationService, type IdCardApplicationRow } from '../modules/conversations/id-card-application.service';

const arrival = { locationId: 'loc_tax_office' } as ArrivalState;

test('acknowledges a missing address neutrally before asking for the country', async () => {
  const application: IdCardApplicationRow = {
    current_field: 'address',
    name: 'Test Learner',
    date_of_birth: '1995-02-28',
    address: null,
    gender: 'female',
    origin: null,
  };
  const client = {
    query: async (sql: string, values: unknown[] = []) => {
      if (sql.includes('SELECT current_field')) return { rows: [application] };
      if (sql.includes('UPDATE public.id_card_applications')) {
        application.current_field = values[1] as IdCardApplicationRow['current_field'];
        application.address = values[2] as string | null;
      }
      return { rows: [], rowCount: 1 };
    },
  } as unknown as PoolClient;
  const service = new IdCardApplicationService(new IdCardApplicationContentService());

  const reply = await service.reply(client, 'user-1', "Sorry, I don't have any address right now", arrival);

  assert.equal(reply?.responseText, "That's okay. You can provide an address later. Where are you from?");
  assert.equal(application.address, null);
  assert.equal(application.current_field, 'origin');
});
