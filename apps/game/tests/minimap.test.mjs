import assert from 'node:assert/strict';
import test from 'node:test';
import { projectPoint, nextMode, readMode } from '../src/features/minimap/model.ts';
import { observeMinimap } from '../src/features/minimap/polling.ts';
import { drawMinimap } from '../src/features/minimap/draw.ts';

test('Minimap projection preserves aspect ratio, centres the map, and clamps every edge', () => {
  const wide = { width: 2000, height: 1000 }, box = { width: 200, height: 200 };
  assert.deepEqual(projectPoint({ x: 0, y: 0 }, wide, box), { x: 0, y: 50 });
  assert.deepEqual(projectPoint({ x: 2000, y: 1000 }, wide, box), { x: 200, y: 150 });
  assert.deepEqual(projectPoint({ x: -100, y: 5000 }, wide, box), { x: 0, y: 150 });
  assert.deepEqual(projectPoint({ x: 500, y: 1000 }, { width: 1000, height: 2000 }, box), { x: 100, y: 100 });
  assert.deepEqual(projectPoint({ x: 1536, y: 1024 }, { width: 1536, height: 1024 }, { width: 150, height: 100 }), { x: 150, y: 100 });
});

test('Map labels include NPCs and exits at readable device-scaled sizes, using a sharp canvas', () => {
  const previousWindow = globalThis.window;
  globalThis.window = { devicePixelRatio: 2 };
  try {
    const texts = [], backgrounds = [], lines = [];
    const context = { font: '', setTransform() {}, clearRect() {}, drawImage() {}, beginPath() {}, rect() {}, arc() {}, fill() {}, stroke() {}, moveTo() {}, lineTo(...args) { lines.push(args); }, fillRect(...args) { backgrounds.push(args); }, strokeText() {},
      measureText(text) { return { width: text.length * 6 }; }, fillText(text, x, y) { texts.push({ text, x, y, font: this.font, align: this.textAlign }); } };
    const canvas = { width: 0, height: 0, clientWidth: 280, getContext: () => context };
    const snapshot = { width: 1536, height: 1024, image: {}, player: { x: 768, y: 500 }, npcs: [{ name: 'Maya', x: 1200, y: 400 }], portals: [{ label: 'Train Station', x: 768, y: 512 }] };
    drawMinimap(canvas, snapshot);
    assert.equal(canvas.width, 560); assert.equal(canvas.height, 373);
    assert.ok(texts.some(label => label.text === 'Maya' && label.font === '11px sans-serif'));
    const exit = texts.find(label => label.text === 'Train Station');
    assert.ok(exit);
    assert.equal(exit.align, 'center'); assert.equal(exit.x, 140);
    assert.ok(exit.y < 280 / 3 - 4, 'Exit name must be above its circle');
    assert.equal(exit.font, '800 12px sans-serif');
    assert.ok(exit.y <= 280 / 3 - 25, 'Building label must leave a clear gap above NPC names');
    const npc = texts.find(label => label.text === 'Maya');
    assert.equal(npc.align, 'center');
    assert.equal(npc.x, 218.75);
    assert.ok(npc.y < 400 * 280 / 1536, 'NPC name must sit above its dot');
    assert.equal(backgrounds.length, 0, 'NPC and exit labels must have no backgrounds');
    assert.equal(lines.length, 0, 'NPC labels must not draw connecting lines');
    assert.ok(texts.every(label => label.x >= 0 && label.x <= 280 && label.y >= 0 && label.y <= 187));
    texts.length = 0; canvas.clientWidth = 560;
    drawMinimap(canvas, snapshot);
    assert.ok(texts.some(label => label.text === 'Maya' && label.font === '14px sans-serif'));
  } finally { globalThis.window = previousWindow; }
});

test('Visible minimaps poll at 10 Hz, pause in hidden tabs and release timers/listeners on teardown', () => {
  const listeners = new Set(), timers = new Map();
  let sequence = 0, reads = 0, published;
  const visibility = { hidden: false, addEventListener: (_, callback) => listeners.add(callback), removeEventListener: (_, callback) => listeners.delete(callback) };
  const timer = { setInterval: (callback, delay) => { assert.equal(delay, 100); const id = ++sequence; timers.set(id, callback); return id; }, clearInterval: id => timers.delete(id) };
  let current = { mapId: 'station', npcs: [{ id: 'station-person' }] };
  const read = () => { reads++; return current; };
  for (let map = 0; map < 10; map++) {
    const stop = observeMinimap(read, value => { published = value; }, visibility, timer);
    assert.equal(listeners.size, 1); assert.equal(timers.size, 1);
    assert.equal(published, current);
    current = null;
    for (const tick of timers.values()) tick();
    assert.equal(published, null, 'transition clears old markers');
    current = { mapId: map % 2 ? 'street' : 'cafe', npcs: [{ id: `person-${map}` }] };
    for (const tick of timers.values()) tick();
    assert.deepEqual(published.npcs, current.npcs, 'new map replaces the old NPC list');
    visibility.hidden = true;
    for (const listener of listeners) listener();
    const pausedReads = reads;
    for (const tick of timers.values()) tick();
    assert.equal(reads, pausedReads); assert.equal(timers.size, 0);
    visibility.hidden = false;
    for (const listener of listeners) listener();
    assert.equal(timers.size, 1);
    stop();
    assert.equal(listeners.size, 0); assert.equal(timers.size, 0);
  }
});

test('Minimap only toggles visibility, preserves saved choices and migrates old sizes', () => {
  assert.equal(nextMode('hidden'), 'visible');
  assert.equal(nextMode('visible'), 'hidden');
  assert.equal(readMode(undefined, 375), 'hidden');
  assert.equal(readMode(undefined, 1024), 'visible');
  for (const mode of ['hidden', 'visible']) assert.equal(readMode({ getItem: () => mode }, 320), mode);
  for (const mode of ['normal', 'expanded']) assert.equal(readMode({ getItem: () => mode }, 320), 'visible');
  assert.equal(readMode({ getItem: () => 'collapsed' }, 1200), 'hidden');
  assert.equal(readMode({ getItem: () => 'broken' }, 1200), 'visible');
  assert.equal(readMode({ getItem() { throw Error('blocked'); } }, 1200), 'visible');
});
