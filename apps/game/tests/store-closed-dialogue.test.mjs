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
      ['cafe', 'Mia', '100% 0%', '08:00–21:00'],
      ['corner_cafe', 'Elena', '100% 0%', '08:00–21:00'],
      ['clothes', 'Ravi', '100% 0%', '10:00–20:00'],
    ];

    for (const [location, owner, portraitPosition, hours] of cases) {
      const html = renderToStaticMarkup(createElement(VenueClosedDialogue, {
        location,
        gameTimeAvailable: true,
        onReturn() {},
      }));
      assert.match(html, new RegExp(`aria-label="${owner} avatar"`));
      assert.ok(html.includes(`background-position:${portraitPosition}`));
      assert.ok(html.includes('background-size:300% 100%'));
      assert.match(html, new RegExp(`<strong>${owner}</strong>`));
      assert.match(html, new RegExp(`Sorry, the store is closed\\. Opening hours are: ${hours}\\.`));
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
    assert.match(html, />OK</);
  });

  test('an active Tax Office conversation explains closing before the player leaves', () => {
    const html = renderToStaticMarkup(createElement(VenueClosedDialogue, {
      location: 'tax_office', conversationNpcId: 'npc_tax_clerk_nadia', gameTimeAvailable: true, onReturn() {},
    }));
    assert.match(html, /aria-label="Nadia avatar"/);
    assert.match(html, /office is closed now/);
    assert.match(html, /open from 08:00–16:00/);
    assert.match(html, /Please come back during those hours/);
    assert.match(html, />Close conversation</);
    assert.doesNotMatch(html, /textarea|input/);
  });
} finally {
  await server.close();
}
