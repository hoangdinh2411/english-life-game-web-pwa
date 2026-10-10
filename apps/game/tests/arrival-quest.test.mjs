import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ArrivalQuest } from '../src/features/station/ArrivalQuest.tsx';
const base = { questId: 'q_station_arrival', status: 'active', currentStepId: 'arrival_ask', ticket: { issued: false, used: false }, canEnterTownStreet: false, locationId: 'loc_station', rewardsGranted: false };
const render = (arrival) => renderToStaticMarkup(createElement(ArrivalQuest, { arrival }));
// A local preview would falsely show completed tutorial progress and omit the real current step.
test('quest UI displays ordered server progress and the next instruction', () => {
  const html = render(base);
  assert.match(html, /1 of 4 steps complete/);
  assert.match(html, /aria-current="step"/);
  assert.match(html, /Ask how to reach town or request a bus ticket/);
  assert.doesNotMatch(html, /Preview goals|ID card/);
  assert.match(html, /No bus ticket yet/);
});
// Receipt and completion must derive from saved ticket/reward fields, never local dialogue.
test('ticket receipt and used status survive rendering a restored completed quest', () => {
  const issued = render({ ...base, currentStepId: 'arrival_exit', ticket: { issued: true, used: false }, canEnterTownStreet: true });
  assert.match(issued, /Bus ticket received/);
  assert.match(issued, /3 of 4 steps complete/);
  const done = render({ ...base, status: 'done', currentStepId: null, ticket: { issued: true, used: true }, locationId: 'loc_town_street', rewardsGranted: true });
  assert.match(done, /4 of 4 steps complete/);
  assert.match(done, /Bus ticket used/);
  assert.match(done, /Rewards saved/);
  assert.doesNotMatch(done, /aria-current="step"/);
});
