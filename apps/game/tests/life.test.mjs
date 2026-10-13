import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', ssr: { external: ['@life-abroad/shared'] } });
try {
  const { savedGameTime, isDefiniteRejection } = await server.ssrLoadModule('/src/features/life/life-clock.ts');
  const { LifeMenu } = await server.ssrLoadModule('/src/features/life/LifeMenu.tsx');
  const { WardrobePanel } = await server.ssrLoadModule('/src/features/life/WardrobePanel.tsx');
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
  test('offline life menu displays saved values and disables all mutations', () => {
    const html = renderToStaticMarkup(createElement(LifeMenu, { life: base, online: false }));
    assert.match(html, /Energy: 50%/);
    assert.match(html, /Balance: \$500/);
    assert.match(html, /Consumed immediately/);
    for (const control of html.matchAll(/<(button|select)\b[^>]*>/g)) assert.match(control[0], /disabled/);
  });
  test('life menu omits opening-hour schedules and appearance controls', () => {
    const html = renderToStaticMarkup(createElement(LifeMenu, { life: base, online: true }));
    assert.doesNotMatch(html, /Organizations|Workplaces|Store hours|Open ·|Closed ·/);
    assert.doesNotMatch(html, /UTC/);
    assert.doesNotMatch(html, /2×/);
    assert.doesNotMatch(html, /Appearance|Wear |Change hair|Trousers/);
  });
  test('wardrobe keeps clothing and appearance changes in a separate panel', () => {
    const html = renderToStaticMarkup(createElement(WardrobePanel, { life: base, online: true, onClose() {} }));
    assert.match(html, /Wardrobe/);
    assert.match(html, /Appearance/);
    assert.match(html, /Hair/);
    assert.match(html, /Trousers/);
    assert.match(html, /You do not own any shirts yet/);
  });
  test('closed shops disable buying and sleep lives in the HUD', () => {
    const html = renderToStaticMarkup(createElement(LifeMenu, { life: { ...base, time: new Date('2026-10-11T14:00:00.000Z') }, online: true }));
    assert.doesNotMatch(html, /Closed|Open ·|Stores 08:00|Store hours/);
    assert.match(html, /<button disabled="">Buy and consume/);
    assert.doesNotMatch(html, /<button[^>]*>Sleep/);
    assert.doesNotMatch(html, /Buy and wear/);
  });
  test('uncertain action blocks new purchases and exposes same-action retry', () => {
    const retry = { path: 'purchase', body: { key: 'saved-key', itemIds: ['espresso'] } };
    const html = renderToStaticMarkup(createElement(LifeMenu, { life: { ...base, retry }, online: true }));
    assert.match(html, /without charging twice/);
    assert.match(html, /<button>Retry previous action/);
    assert.doesNotMatch(html, /<button[^>]*>Sleep/);
  });
  test('HUD energy is labelled, readable without color, and explains empty/low energy', () => {
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
  test('player HUD distinguishes saved energy, loading, and free local practice', () => {
    const props = { playerName: 'Learner', cityName: 'Maplewood', xp: 0, coins: 500 };
    const saved = renderToStaticMarkup(createElement(PlayerInfoCard, { ...props, energy: 50, savedTime: new Date(state.gameTime) }));
    assert.match(saved, /aria-valuenow="50"/);
    assert.doesNotMatch(saved, /UTC/);
    assert.doesNotMatch(saved, /2×|times real time/);
    assert.doesNotMatch(saved, /No energy cost/);
    const loading = renderToStaticMarkup(createElement(PlayerInfoCard, { ...props, savedTime: null }));
    assert.match(loading, /Loading energy/);
    const practice = renderToStaticMarkup(createElement(PlayerInfoCard, props));
    assert.match(practice, /Local practice · No energy cost/);
    assert.doesNotMatch(practice, /role="progressbar"/);
  });
} finally { await server.close(); }


