import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom', ssr: { external: ['@life-abroad/shared'] } });
try {
  const { VenueClosedDialogue } = await server.ssrLoadModule('/src/features/location/VenueClosedDialogue.tsx');

  test('closed-store conversation shows the store owner, avatar and hours', () => {
    const cases = [
      ['cafe', 'Mia', '100% 0%'],
      ['corner_cafe', 'Elena', '100% 0%'],
      ['clothes', 'Ravi', '100% 0%'],
    ];

    for (const [location, owner, portraitPosition] of cases) {
      const html = renderToStaticMarkup(createElement(VenueClosedDialogue, {
        location,
        gameTimeAvailable: true,
        onReturn() {},
      }));
      assert.match(html, new RegExp(`aria-label="${owner} avatar"`));
      assert.ok(html.includes(`background-position:${portraitPosition}`));
      assert.ok(html.includes('background-size:300% 100%'));
      assert.match(html, new RegExp(`<strong>${owner}</strong>`));
      assert.match(html, /Sorry, the store is closed\. Opening hours are: 08:00–14:00\./);
      assert.doesNotMatch(html, /UTC/);
    }
  });

  test('unknown game time gives an owner dialogue without claiming a schedule', () => {
    const html = renderToStaticMarkup(createElement(VenueClosedDialogue, {
      location: 'corner_cafe',
      gameTimeAvailable: false,
      onReturn() {},
    }));
    assert.match(html, /aria-label="Elena avatar"/);
    assert.match(html, /I can’t confirm whether the store is open right now/);
    assert.doesNotMatch(html, /Opening hours are:/);
  });

  test('closed Tax Office conversation identifies staff and organization hours', () => {
    const html = renderToStaticMarkup(createElement(VenueClosedDialogue, {
      location: 'tax_office', gameTimeAvailable: true, onReturn() {},
    }));
    assert.match(html, /aria-label="Marcus avatar"/);
    assert.match(html, /Sorry, the office is closed\. Opening hours are: 08:00–16:00\./);
  });
} finally {
  await server.close();
}
