import assert from 'node:assert/strict';
import test from 'node:test';
import { parseIdCardBirthDate } from '../modules/conversations/id-card-birth-date';
import { IdCardApplicationContentService } from '../modules/conversations/id-card-application-content.service';

const today = new Date('2026-10-28T12:00:00.000Z');

test('normalizes clear English birth dates to the database format', () => {
  for (const input of ['1992-11-24', '24 November 1992', '24th November 1992',
    'November 24, 1992', '1992 November 24th']) {
    assert.equal(parseIdCardBirthDate(input, today), '1992-11-24');
  }
  assert.equal(parseIdCardBirthDate('1st November 1992', today), '1992-11-01');
  assert.equal(parseIdCardBirthDate('November 2nd, 1992', today), '1992-11-02');
  assert.equal(parseIdCardBirthDate('3rd November 1992', today), '1992-11-03');
  assert.equal(parseIdCardBirthDate('November 21st 1992', today), '1992-11-21');
});

test('rejects ambiguous, incomplete, impossible, future, and out-of-policy dates', () => {
  for (const input of ['03/04/1992', 'November 24th', '31 February 1992',
    'November 24th, 2027', '24 November 1899', '1st', '24th']) {
    assert.equal(parseIdCardBirthDate(input, today), null);
  }
});

test('keeps machine formatting out of the birthday question', async () => {
  const content = await new IdCardApplicationContentService().get();
  assert.equal(content.prompts.dateOfBirth, 'Thanks. When were you born?');
  assert.doesNotMatch(content.prompts.dateOfBirth, /YYYY|1900|today/i);
  assert.match(content.retries.dateOfBirth, /24 November 1992/i);
});
