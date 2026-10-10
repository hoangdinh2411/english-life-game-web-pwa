// Manual browser test fixture, served by Vite; excluded from production builds.
/* global document, performance, requestAnimationFrame */
import Phaser from 'phaser';
import { createStationGame } from '../src/gameplay/create-station-game.ts';

let captured;
function capture(game) { captured = game; }
const OriginalGame = Phaser.Game;
Phaser.Game = class extends OriginalGame { constructor(config) { super(config); capture(this); } };
const result = document.querySelector('#result');
let ready = false, location = '', failure = '';
const instance = createStationGame(document.querySelector('#world'), {
  initialLocation: 'street', onEnterStreet: async () => true,
  onReady: () => { ready = true; }, onLocationChange: (value) => { location = value; },
  onProgress: (value) => { result.textContent = `Downloading ${Math.round(value * 100)}%`; },
  onNearby: () => {}, onTalk: () => {}, onExitBlocked: () => { failure = 'Exit unexpectedly blocked'; },
  onError: (value) => { failure = value; result.textContent = `FAIL: ${value}`; },
});
instance.unlockExit(true);
Phaser.Game = OriginalGame;

function assert(value, message) { if (!value) throw new Error(message); }
const tick = () => new Promise((resolve) => requestAnimationFrame(resolve));
async function waitReady(expected) {
  const end = performance.now() + 20000;
  while (!ready || !location.includes(expected)) {
    assert(!failure, failure); assert(performance.now() < end, `Timed out entering ${expected}`); await tick();
  }
}
function snapshot() {
  const scene = captured.scene.scenes[0];
  const textures = captured.textures.getTextureKeys().sort();
  const pixels = textures.reduce((sum, key) => sum + captured.textures.get(key).source.reduce((size, source) => size + source.width * source.height, 0), 0);
  return { textures: textures.filter((key) => key.startsWith('pack:')), textureCount: textures.length, textureBytes: pixels * 4, audio: captured.cache.audio.getKeys().sort(), json: captured.cache.json.getKeys().sort(),
    animations: captured.anims.anims.size, objects: scene.children.length,
    resizeListeners: scene.scale.listenerCount('resize'), keyboardListeners: scene.input.keyboard.listenerCount('keydown-E') };
}
async function walk(target, expected) {
  const scene = captured.scene.scenes[0];
  scene.input.emit('pointerdown', { worldX: target.x, worldY: target.y }, []);
  // Accelerate movement through the real scene update and portal authorization path.
  for (let frame = 0; frame < 250; frame++) {
    scene.update(frame * 50, 50);
    if (frame % 10 === 0) await Promise.resolve();
  }
  await waitReady(expected);
}
async function roundTrip() {
  ready = false;
  await walk({ x: 768, y: 130 }, 'Train Station');
  ready = false;
  await walk({ x: 768, y: 944 }, 'Town Street');
}
document.querySelector('#run').addEventListener('click', async () => {
  document.querySelector('#run').disabled = true;
  try {
    await waitReady('Town Street');
    await roundTrip(); // Warm caches before measuring.
    const baseline = snapshot(), samples = [];
    for (let trip = 1; trip <= 10; trip++) {
      await roundTrip();
      const sample = snapshot();
      assert(JSON.stringify(sample) === JSON.stringify(baseline), `Resources changed on trip ${trip}: baseline=${JSON.stringify(baseline)} current=${JSON.stringify(sample)}`);
      assert(sample.textures.every((key) => !['station','player','backpack','suitcase','receptionist'].includes(key)), 'Previous station textures survived');
      samples.push({ trip, ...sample });
      result.textContent = `Verified ${trip}/10 trips`;
    }
    instance.pause(true);
    result.textContent = JSON.stringify({ status: 'PASS', trips: 10, baseline, samples,
      heapBytes: performance.memory?.usedJSHeapSize ?? null,
      note: 'Real Phaser portal transitions; stable textures, estimated texture bytes, audio/JSON/animations, scene objects and listeners. Heap total is observational, not a GC-controlled leak assertion.' }, null, 2);
  } catch (error) { result.textContent = `FAIL: ${error.message}`; }
});
await waitReady('Town Street');
result.textContent = 'Town Street loaded from Storage. Ready to verify portal trips.';
