import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

let tutorialPages = [];
let tutorialNarrationText;
let completeMovementTutorial;
let movementTutorialSeen;
let tutorialKeyboardAction;
let tutorialPageAfter;
let tutorialPrimaryLabel;
let tutorialReturnSurface;
try {
  ({ tutorialNarrationText, tutorialPages } = await import('../src/features/tutorial/tutorial-pages.ts'));
  ({ completeMovementTutorial, movementTutorialSeen, tutorialKeyboardAction, tutorialPageAfter, tutorialPrimaryLabel, tutorialReturnSurface }
    = await import('../src/features/tutorial/tutorial-state.ts'));
} catch {
  // The first run records the missing tutorial model as assertion failures.
}

test('tutorial content has the approved five-page order and concise copy', () => {
  assert.deepEqual(tutorialPages.map(page => page.title), [
    'Move Around',
    'Talk and Interact',
    'Follow Your Goals',
    'Practice English',
    'Use the Game Menu',
  ]);
  assert.equal(tutorialPages.length, 5);
  for (const page of tutorialPages) {
    assert.ok(page.description.split(/[.!?]+/).filter(Boolean).length <= 2);
    assert.ok(page.illustrationAlt.length > 0);
  }
});

test('tutorial narration reads the visible page copy', () => {
  assert.equal(
    tutorialNarrationText(tutorialPages[0]),
    `Move Around. ${tutorialPages[0].description}`,
  );
  assert.equal(
    tutorialNarrationText(tutorialPages[1]),
    `Talk and Interact. ${tutorialPages[1].description}`,
  );
});

test('page state clamps Back and Next and names the final action', () => {
  assert.equal(tutorialPageAfter(0, 'previous'), 0);
  assert.equal(tutorialPageAfter(0, 'next'), 1);
  assert.equal(tutorialPageAfter(4, 'next'), 4);
  assert.equal(tutorialPageAfter(4, 'previous'), 3);
  assert.equal(tutorialPrimaryLabel(0), 'Next');
  assert.equal(tutorialPrimaryLabel(4), 'Start Exploring');
});

test('first-run completion returns to the game while menu replay returns to the menu', () => {
  assert.equal(tutorialReturnSurface('first-run'), 'game');
  assert.equal(tutorialReturnSurface('menu'), 'menu');
});

test('arrow keys and Escape map to navigation except while editing a form control', () => {
  assert.equal(tutorialKeyboardAction('ArrowLeft', false), 'previous');
  assert.equal(tutorialKeyboardAction('ArrowRight', false), 'next');
  assert.equal(tutorialKeyboardAction('Escape', false), 'close');
  assert.equal(tutorialKeyboardAction('Enter', false), null);
  for (const key of ['ArrowLeft', 'ArrowRight', 'Escape']) assert.equal(tutorialKeyboardAction(key, true), null);
});

test('seen state is written only by explicit completion', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  assert.equal(movementTutorialSeen(storage), false);
  assert.equal(tutorialKeyboardAction('Escape', false), 'close');
  assert.equal(movementTutorialSeen(storage), false);
  completeMovementTutorial(storage);
  assert.equal(values.get('movementTutorialSeen'), '1');
  assert.equal(movementTutorialSeen(storage), true);
});

const server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' });
try {
  let MovementTutorial;
  try {
    ({ MovementTutorial } = await server.ssrLoadModule('/src/features/tutorial/MovementTutorial.tsx'));
  } catch {
    // The first run records the missing tutorial feature as an assertion failure.
  }

  test('first page renders progress, Skip and Next without Back', () => {
    assert.equal(typeof MovementTutorial, 'function');
    const html = renderToStaticMarkup(createElement(MovementTutorial, {
      playerName: 'Learner', sound: true, source: 'first-run', onClose() {},
    }));
    assert.match(html, />Move Around</);
    assert.match(html, />1 \/ 5</);
    assert.match(html, />Skip</);
    assert.match(html, />Next</);
    assert.doesNotMatch(html, />Back</);
    assert.match(html, /role="img"/);
    assert.match(html, /tutorial-scenes\.png/);
    assert.doesNotMatch(html, /Settings controls|Dialogue settings|role="switch"/);
  });
} finally {
  await server.close();
}
