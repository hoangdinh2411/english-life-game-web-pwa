import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IdCardApplicationReview, parseIdCardReview } from '../src/features/id-card/IdCardApplicationReview.tsx';

const text = 'Here is your application:\n• Name: William\n• Address: Not provided\n\nWould you like to change anything, or should I issue the ID card?';

test('ID-card review separates the information from the final confirmation question', () => {
  assert.deepEqual(parseIdCardReview(text), {
    heading: 'Here is your application:',
    fields: [{ label: 'Name', value: 'William' }, { label: 'Address', value: 'Not provided' }],
    question: 'Would you like to change anything, or should I issue the ID card?',
  });
  const html = renderToStaticMarkup(createElement(IdCardApplicationReview, {
    text,
    photo: createElement('img', { src: 'preview:test', alt: 'Selected photo preview' }),
  }));
  assert.match(html, /aria-label="ID card application review"/);
  assert.ok(html.indexOf('Selected photo preview') < html.indexOf('Name'));
  assert.ok(html.indexOf('Not provided') < html.indexOf('Would you like to change anything'));
});
