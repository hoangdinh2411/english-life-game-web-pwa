import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  ssr: { external: ['@life-abroad/shared'] },
});

try {
  let GameMenu;
  let gameMenuCanvasState;
  try {
    ({ GameMenu } = await server.ssrLoadModule('/src/features/game-menu/GameMenu.tsx'));
    ({ gameMenuCanvasState } = await server.ssrLoadModule('/src/features/game-menu/game-menu-state.ts'));
  } catch {
    // The first run records the missing menu feature as an assertion failure.
  }

  test('the game menu presents the four actions in the approved order', () => {
    assert.equal(typeof GameMenu, 'function');
    const html = renderToStaticMarkup(createElement(GameMenu, {
      onOpenTutorial() {},
      onSignOut() {},
      onReturnToGame() {},
      onOpenSettings() {},
    }));
    const labels = [...html.matchAll(/<button[^>]*>([^<]+)<\/button>/g)].map(match => match[1]);
    assert.deepEqual(labels, [
      'Movement Tutorial',
      'Sign Out',
      'Return to the Game',
      'Settings',
    ]);
    assert.match(html, /aria-label="Game menu"/);
    assert.doesNotMatch(html, /Paused|role="switch"|type="range"/);
  });

  test('opening the menu captures player input without pausing the simulated world', () => {
    assert.equal(typeof gameMenuCanvasState, 'function');
    assert.deepEqual(gameMenuCanvasState({ menuOpen: true, worldBlockerOpen: false }), {
      playerInputPaused: true,
      worldPaused: false,
    });
    assert.deepEqual(gameMenuCanvasState({ menuOpen: false, worldBlockerOpen: false }), {
      playerInputPaused: false,
      worldPaused: false,
    });
    assert.deepEqual(gameMenuCanvasState({ menuOpen: true, worldBlockerOpen: true }), {
      playerInputPaused: true,
      worldPaused: true,
    });
  });
} finally {
  await server.close();
}
