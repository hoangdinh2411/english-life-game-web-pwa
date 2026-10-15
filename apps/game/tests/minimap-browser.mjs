// Real StationScreen/Phaser UI with fictional HUD data. No account or API writes.
/* global document, window, performance, requestAnimationFrame, innerWidth, innerHeight */
import React from 'react';
import { createRoot } from 'react-dom/client';
import Phaser from 'phaser';
import StationScreen from '../src/gameplay/StationScreen.tsx';
import { PwaProvider } from '../src/pwa/PwaProvider.tsx';
import { STREET_NPCS } from '../src/features/npcs/street-npcs.ts';
import '../src/styles.css';

let captured;
function capture(game) { captured = game; }
const OriginalGame = Phaser.Game;
Phaser.Game = class extends OriginalGame { constructor(config) { super(config); capture(this); } };
const root = document.querySelector('#root');
root.className = 'h-dvh flex flex-col';
const controls = document.createElement('footer');
controls.className = 'shrink-0 max-h-36 overflow-auto bg-[#fff8e7] p-1 text-xs';
const status = document.createElement('pre');
status.setAttribute('role', 'status');
status.className = 'whitespace-pre-wrap break-words';
const buttons = document.createElement('div');
buttons.className = 'flex flex-wrap gap-1';
controls.append(buttons, status);
document.body.append(controls);
createRoot(root).render(React.createElement(PwaProvider, null,
  React.createElement(StationScreen, { playerName: 'Fictional minimap preview', xp: 0, coins: 99999, onSignOut() {},
    life: { time: new Date('2026-10-15T10:00:00Z'), state: null, refresh: async () => {} },
    arrival: { initialLocation: 'station', exitUnlocked: true, pending: false, error: '', online: true, goalsLabel: 'Preview', questPanel: null, statusPanel: null, blockedExitMessage: '', onRetry() {}, onOpenReceptionist() {}, onEnterStreet: async () => true, renderReceptionist: () => 'Fictional conversation preview' },
  })));
// Keep verification controls outside the game viewport.
document.body.className = 'h-dvh flex flex-col overflow-hidden';
root.className = 'flex flex-col flex-1 min-h-0';
function assert(value, message) { if (!value) throw Error(message); }
const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
async function until(predicate, message) {
  const end = performance.now() + 20000;
  while (!predicate()) { assert(performance.now() < end, message); await frame(); }
}
function scene() { return captured?.scene.scenes[0]; }
async function showMap(map) {
  await until(() => scene()?.worldReady, 'Scene failed to become ready');
  scene().enterLocation(map);
  await until(() => scene()?.worldReady && !scene().transitionPending, `Map failed to load: ${map}`);
  status.textContent = `Loaded ${map}. Fictional preview; no account changes.`;
}
for (const map of ['station', 'cafe', 'clothes', 'street']) {
  const button = document.createElement('button');
  button.className = 'min-h-11 border px-2'; button.textContent = `Show ${map}`;
  button.onclick = () => { void showMap(map).catch(error => { status.textContent = `FAIL: ${error.message}`; }); };
  buttons.append(button);
}
const run = document.createElement('button');
run.className = 'min-h-11 border px-2'; run.textContent = 'Verify minimap transitions';
buttons.append(run);
function bounds(element) { return element.getBoundingClientRect(); }
function overlaps(a, b) { return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; }
function layoutCheck() {
  const map = document.querySelector('section[aria-label="Minimap"]');
  assert(map, 'Minimap must be visible');
  const rect = bounds(map);
  assert(rect.left >= 0 && rect.right <= innerWidth + 1, 'Minimap leaves the viewport');
  assert(document.documentElement.scrollWidth <= innerWidth, 'Horizontal overflow');
  for (const element of document.querySelectorAll('.station-hud button,.goals-control,.talk-control')) {
    const other = bounds(element);
    if (other.width && other.height) assert(!overlaps(rect, other), `Minimap overlaps ${element.getAttribute('aria-label') ?? element.textContent}`);
  }
  for (const element of map.querySelectorAll('button')) assert(bounds(element).width >= 43.9 && bounds(element).height >= 43.9, 'Minimap touch target below 44px');
}
run.onclick = async () => {
  run.disabled = true;
  try {
    await showMap('station');
    await until(() => document.querySelector('section[aria-label="Minimap"]'), 'HUD not ready');
    await frame();
    // Walk to Ruth through the real actor click/scene update path. The fixture's
    // receptionist content is local, so this does not create a conversation.
    scene().npcActors.find(actor => actor.npc.id === 'npc_station_information').sprite.emit('pointerdown');
    for (let frame = 0; frame < 400; frame++) scene().update(frame * 50, 50);
    await until(() => document.querySelector('[role="dialog"]'), 'Conversation did not open');
    assert(!document.querySelector('section[aria-label="Minimap"]'), 'Minimap visible over conversation');
    [...document.querySelectorAll('[role="dialog"] button')].find(button => button.textContent === 'Close')?.click();
    await until(() => !document.querySelector('[role="dialog"]'), 'Conversation failed to close');
    document.querySelector('button[aria-label="Show minimap"]')?.click();
    const samples = [];
    for (let index = 0; index < 10; index++) {
      const map = ['street', 'station', 'cafe', 'clothes'][index % 4];
      await showMap(map);
      await until(() => document.querySelector('#minimap-content canvas'), 'Minimap canvas missing');
      // Wait for one published 10 Hz snapshot, then compare against the real scene.
      const expected = scene().npcActors.map(actor => actor.npc.name);
      await until(() => document.querySelector('#minimap-content canvas')?.getAttribute('data-map-id') === map && document.querySelector('#minimap-content canvas')?.getAttribute('aria-label')?.startsWith(`Current map: ${expected.length} people.`), 'Stale map markers');
      if (map === 'street') {
        assert(STREET_NPCS.every(npc => expected.includes(npc.name)), 'Missing Town Street resident');
        const positions = scene().npcActors.map(actor => ({ x: actor.npc.x / 1.5, y: actor.npc.y / 1.5 }));
        for (const contains of [point => point.x < 700 && point.y < 500, point => point.x > 900 && point.y < 500,
          point => point.x < 700 && point.y > 800, point => point.x > 900 && point.y > 800]) {
          assert(positions.filter(contains).length === 3, 'Served actor positions do not populate all four neighborhoods');
        }
      }
      const description = document.querySelector('#minimap-content canvas').getAttribute('aria-label');
      assert(expected.every(name => description.includes(name)), 'Missing accessible NPC name');
      assert(document.querySelector('#minimap-content h2')?.textContent.includes('Maplewood'), 'Map title missing');
      assert(!document.querySelector('#minimap-content ol,#minimap-content ul'), 'Removed text lists returned');
      layoutCheck();
      const shownWidth = bounds(document.querySelector('section[aria-label="Minimap"]')).width;
      if (innerWidth >= 1024 && innerHeight >= 750) assert(shownWidth > 360, 'Desktop map should be larger');
      document.querySelector('button[aria-label="Hide minimap"]')?.click();
      await until(() => document.querySelector('button[aria-label="Show minimap"]'), 'Hidden state missing');
      assert(!document.querySelector('#minimap-content'), 'Hidden canvas still mounted');
      document.querySelector('button[aria-label="Show minimap"]')?.click();
      await until(() => document.querySelector('#minimap-content canvas'), 'Shown state missing');
      assert(Math.abs(bounds(document.querySelector('section[aria-label="Minimap"]')).width - shownWidth) < 1, 'Toggle changed the map size');
      const sample = { map, markers: expected.length, resize: scene().scale.listenerCount('resize'), keyboard: scene().input.keyboard.listenerCount('keydown-E'), postrender: captured.events.listenerCount('postrender') };
      const previous = samples.find(sample => sample.map === map);
      if (previous) assert(JSON.stringify(previous) === JSON.stringify(sample), 'Scene listener count changed');
      samples.push(sample);
    }
    await showMap('street');
    const deltas = [];
    let last = performance.now();
    const end = last + 2000;
    while (performance.now() < end) { await frame(); const now = performance.now(); deltas.push(now - last); last = now; }
    const sorted = [...deltas].sort((a, b) => a - b);
    const performanceSample = { frames: deltas.length, medianFrameMs: Math.round(sorted[Math.floor(sorted.length / 2)] * 10) / 10, p95FrameMs: Math.round(sorted[Math.floor(sorted.length * 0.95)] * 10) / 10 };
    status.textContent = JSON.stringify({ status: 'PASS', switches: 10, viewport: { width: innerWidth, height: innerHeight }, samples, performanceSample });
  } catch (error) { status.textContent = `FAIL: ${error.message}`; }
  finally { run.disabled = false; }
};
window.addEventListener('pagehide', () => { captured?.destroy(true); Phaser.Game = OriginalGame; }, { once: true });
