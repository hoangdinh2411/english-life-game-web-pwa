import assert from 'node:assert/strict';
import test from 'node:test';

import * as hud from '../src/gameplay/arrival-hud.ts';

test('quest board appears only after the tutorial closes and the map is ready', () => {
  assert.equal(typeof hud.shouldShowQuestBoard, 'function');
  assert.equal(hud.shouldShowQuestBoard({ tutorialOpen: true, mapReady: true }), false);
  assert.equal(hud.shouldShowQuestBoard({ tutorialOpen: false, mapReady: false }), false);
  assert.equal(hud.shouldShowQuestBoard({ tutorialOpen: false, mapReady: true }), true);
});

test('mock arrival goals show the tutorial completed and the receptionist as the next goal', () => {
  assert.ok(Array.isArray(hud.mockArrivalGoals));
  assert.deepEqual(hud.mockArrivalGoals.map(({ title, status }) => ({ title, status })), [
    { title: 'Learn to explore', status: 'complete' },
    { title: 'Ask the receptionist for directions', status: 'current' },
    { title: 'Get a bus ticket', status: 'upcoming' },
    { title: 'Get an ID card at the tax office', status: 'locked' },
  ]);
});

test('local practice advances to the ticket goal after directions without completing the ticket', () => {
  const goals = hud.practiceArrivalGoals(true);
  assert.deepEqual(goals.map(({ id, status }) => ({ id, status })), [
    { id: 'tutorial', status: 'complete' },
    { id: 'receptionist', status: 'complete' },
    { id: 'ticket', status: 'current' },
    { id: 'id-card', status: 'locked' },
  ]);
  assert.equal(hud.mockArrivalGoals[1]?.status, 'current');
});
