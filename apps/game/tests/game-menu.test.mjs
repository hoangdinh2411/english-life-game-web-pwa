import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const server = await createServer({
  server: { middlewareMode: true, ws: false },
  appType: 'custom',
  ssr: { external: ['@life-abroad/shared'] },
});

try {
  let GameMenu;
  let EnglishReviewPanel;
  let gameMenuCanvasState;
  try {
    ({ GameMenu } = await server.ssrLoadModule('/src/features/game-menu/GameMenu.tsx'));
    ({ gameMenuCanvasState } = await server.ssrLoadModule('/src/features/game-menu/game-menu-state.ts'));
  } catch {
    // The first run records the missing menu feature as an assertion failure.
  }
  try {
    ({ EnglishReviewPanel } = await server.ssrLoadModule('/src/features/game-menu/EnglishReviewPanel.tsx'));
  } catch {
    // The first run records the missing review panel as an assertion failure.
  }

  test('the signed-in game menu presents all five required actions in the approved order', () => {
    assert.equal(typeof GameMenu, 'function');
    const html = renderToStaticMarkup(createElement(GameMenu, {
      onOpenTutorial() {},
      onOpenReview() {},
      onSignOut() {},
      onReturnToGame() {},
      onOpenSettings() {},
    }));
    const labels = [...html.matchAll(/<button[^>]*>(.*?)<\/button>/gs)]
      .map(match => match[1].replace(/<[^>]+>/g, ''));
    assert.deepEqual(labels, [
      'English Review',
      'Movement Tutorial',
      'Sign Out',
      'Return to the Game',
      'Settings',
    ]);
    assert.match(html, /aria-label="Game menu"/);
    assert.equal((html.match(/<svg/g) ?? []).length, 5, 'every menu action should have an SVG icon');
    assert.doesNotMatch(html, /🔊|🔇|▶️|🗺️|📜|⚙️/u);
    assert.doesNotMatch(html, /Paused|role="switch"|type="range"/);
  });

  test('game menu actions keep a 44px minimum touch target', () => {
    const html = renderToStaticMarkup(createElement(GameMenu, {
      onOpenTutorial() {},
      onOpenReview() {},
      onSignOut() {},
      onReturnToGame() {},
      onOpenSettings() {},
    }));
    const actionButtons = [...html.matchAll(/<button[^>]*class="([^"]+)"/g)];
    assert.equal(actionButtons.length, 5);
    for (const [, className] of actionButtons) assert.match(className, /\bmin-h-11\b/);
  });

  test('local practice omits account review and uses the approved exit label', () => {
    const html = renderToStaticMarkup(createElement(GameMenu, {
      practice: true,
      onOpenReview() {},
      onOpenTutorial() {},
      onSignOut() {},
      onReturnToGame() {},
      onOpenSettings() {},
    }));
    assert.doesNotMatch(html, /English Review|Sign Out/);
    assert.match(html, />Leave Local Practice</);
    assert.match(html, />Movement Tutorial</);
    assert.match(html, />Return to the Game</);
    assert.match(html, />Settings</);
  });

  test('utility overlays capture player input without pausing the simulated world', () => {
    assert.equal(typeof gameMenuCanvasState, 'function');
    for (const overlay of ['menu', 'settings', 'English Review', 'Movement Tutorial']) {
      assert.deepEqual(
        gameMenuCanvasState({ inputOverlayOpen: true, worldBlockerOpen: false }),
        { playerInputPaused: true, worldPaused: false },
        `${overlay} should leave the world running`,
      );
    }
    assert.deepEqual(gameMenuCanvasState({ inputOverlayOpen: false, worldBlockerOpen: false }), {
      playerInputPaused: false,
      worldPaused: false,
    });
    assert.deepEqual(gameMenuCanvasState({ inputOverlayOpen: true, worldBlockerOpen: true }), {
      playerInputPaused: true,
      worldPaused: true,
    });
  });

  test('English Review opens a usable empty-state utility panel', () => {
    assert.equal(typeof EnglishReviewPanel, 'function');
    const html = renderToStaticMarkup(createElement(EnglishReviewPanel, { onClose() {} }));
    assert.match(html, /aria-label="English Review"/);
    assert.match(html, /saved words and corrections/i);
    assert.match(html, />Back to Game Menu</);
  });
} finally {
  await server.close();
}
