import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', ssr: { external: ['@life-abroad/shared'] } });
try {
  const { savedGameTime, isDefiniteRejection } = await server.ssrLoadModule('/src/features/life/life-clock.ts');
  const { PlayerProfileDialogue } = await server.ssrLoadModule('/src/features/life/PlayerProfileDialogue.tsx');
  const { EnergyDisplay } = await server.ssrLoadModule('/src/features/life/EnergyDisplay.tsx');
  const { PlayerInfoCard } = await server.ssrLoadModule('/src/gameplay/PlayerInfoCard.tsx');
  const state = { energy: 50, coins: 500, gameTime: '2026-10-11T10:00:00.000Z', serverTime: '2026-10-11T08:00:00.000Z', clockRate: 2, appearance: { hair: 'brown', shirt: null, trousers: 'navy' }, ownedShirts: [] };
  const catalog = [ { id: 'espresso', name: 'Espresso', kind: 'drink', price: 5, shop: 'cafe' }, { id: 'blue_shirt', name: 'Blue shirt', kind: 'clothing', price: 30, shop: 'clothes' } ];
  const base = { state, catalog, pending: false, error: '', retry: null, act: async () => {}, reload: async () => {}, refresh: async () => {}, time: new Date(state.gameTime) };
  test('saved clock advances twice elapsed time from authoritative value and never reverses for a local clock shift', () => {
    assert.equal(savedGameTime(state, 1000, 61000).toISOString(), '2026-10-11T10:02:00.000Z');
    assert.equal(savedGameTime(state, 1000, 0).toISOString(), state.gameTime);
  });
  test('uncertain responses retain retry while definite business rejections release it', () => {
    for (const error of [new Error('Network lost'), { status: 401 }, { status: 429 }, { status: 500 }]) assert.equal(isDefiniteRejection(error), false);
    for (const status of [400, 403, 404, 409, 422]) assert.equal(isDefiniteRejection({ status }), true);
  });
  test('energy is labelled, readable without color, and explains empty/low energy', () => {
    for (const energy of [0, 20, 100]) {
      const html = renderToStaticMarkup(createElement(EnergyDisplay, { energy }));
      assert.match(html, /role="progressbar"/);
      assert.match(html, new RegExp(`aria-valuenow="${energy}"`));
      assert.match(html, new RegExp(`${energy}%`));
      if (energy === 0) assert.match(html, /No energy.*Sleep or eat/);
      else if (energy === 20) assert.match(html, /Low energy/);
    }
    const loading = renderToStaticMarkup(createElement(EnergyDisplay));
    assert.match(loading, /Loading energy/);
    assert.doesNotMatch(loading, /aria-valuenow/);
  });
  test('sleep icon permits 49% but blocks 50%, full energy and unavailable actions', () => {
    for (const energy of [0, 49, 50, 100]) {
      const html = renderToStaticMarkup(createElement(EnergyDisplay, { energy, onSleep() {} }));
      assert.match(html, new RegExp(`aria-disabled="${energy >= 50}"`));
      assert.match(html, /Sleep to restore energy/);
      assert.match(html, /role="tooltip"/);
      assert.match(html, /energy-battery/);
    }
    assert.match(renderToStaticMarkup(createElement(EnergyDisplay, { energy: 49, onSleep() {}, sleepDisabled: true })), /aria-disabled="true"/);
  });
  test('player HUD card opens profile and keeps only a compact identity and clock', () => {
    const props = { playerName: 'Learner', cityName: 'Maplewood', coins: 500, onOpenProfile() {} };
    const saved = renderToStaticMarkup(createElement(PlayerInfoCard, { ...props, savedTime: new Date(state.gameTime) }));
    assert.match(saved, /aria-label="Open Learner&#x27;s profile"/);
    assert.match(saved, /Maplewood · \$500/);
    assert.doesNotMatch(saved, /aria-valuenow|Experience|XP/);
    assert.doesNotMatch(saved, /UTC/);
    assert.doesNotMatch(saved, /2×|times real time/);
  });
  test('player profile shows sourced character status without wardrobe or shop ordering', () => {
    const html = renderToStaticMarkup(createElement(PlayerProfileDialogue, {
      playerName: 'Learner', cityName: 'Maplewood', xp: 42, coins: 500,
      life: base, online: true, practice: false,
      onClose() {},
    }));
    assert.match(html, /role="dialog" aria-modal="true" aria-label="Your character"/);
    assert.match(html, /Your character/);
    assert.match(html, /Learner/);
    assert.match(html, /42 XP/);
    assert.match(html, /\$500/);
    assert.match(html, /aria-valuenow="50"/);
    assert.match(html, /Hair:.*brown/);
    assert.match(html, /Trousers:.*navy/);
    assert.doesNotMatch(html, /wardrobe/i);
    assert.doesNotMatch(html, /Buy and consume|Drink \(\+|Café/);
  });
  test('player profile retains retry for an uncertain saved action', () => {
    const retry = { path: 'sleep', body: { key: 'saved-key' } };
    const html = renderToStaticMarkup(createElement(PlayerProfileDialogue, {
      playerName: 'Learner', cityName: 'Maplewood', xp: 0, coins: 500,
      life: { ...base, retry, error: 'The result is uncertain.' },
      online: true, practice: false, onClose() {},
    }));
    assert.match(html, /role="alert"/);
    assert.match(html, /Retry previous action/);
  });
} finally { await server.close(); }


