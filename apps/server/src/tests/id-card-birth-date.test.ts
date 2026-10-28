import assert from 'node:assert/strict';
import test from 'node:test';
import { parseIdCardBirthDate } from '../modules/conversations/id-card-birth-date';
import { IdCardApplicationContentService } from '../modules/conversations/id-card-application-content.service';

const today = new Date('2026-10-28T12:00:00.000Z');

// Defect: valid natural English dates are rejected unless they use YYYY-MM-DD.
test('normalizes clear natural birth dates to the database date format', () => {
  assert.equal(parseIdCardBirthDate('1992 November 24th', today), '1992-11-24');
  assert.equal(parseIdCardBirthDate('24th November 1992', today), '1992-11-24');
  assert.equal(parseIdCardBirthDate('1992-11-24', today), '1992-11-24');
});

test('asks again for incomplete, impossible, future, or out-of-policy dates', () => {
  assert.equal(parseIdCardBirthDate('November 24th', today), null);
  assert.equal(parseIdCardBirthDate('31 February 1992', today), null);
  assert.equal(parseIdCardBirthDate('November 24th 2027', today), null);
  assert.equal(parseIdCardBirthDate('24 November 1899', today), null);
  assert.equal(parseIdCardBirthDate('03/04/1992', today), null);
});

test('keeps format and range rules out of the initial question', async () => {
  const content = await new IdCardApplicationContentService().get();
  assert.equal(content.prompts.dateOfBirth, 'What is your date of birth?');
  assert.doesNotMatch(content.prompts.dateOfBirth, /YYYY|1900|today/i);
  assert.match(content.retries.dateOfBirth, /1900 through today/i);
  assert.match(content.retries.dateOfBirth, /24 November 1992/i);
});
