import assert from 'node:assert/strict';
import test from 'node:test';
import { clearDevelopmentWorker } from '../src/pwa/clear-development-worker.ts';

test('development removes only this app worker and public cache, preserving other caches', async () => {
  const removed=[];
  const worker=path=>({active:{scriptURL:'http://localhost:8082'+path},unregister:async()=>{removed.push(path);return true;}});
  await clearDevelopmentWorker({getRegistrations:async()=>[worker('/sw.js'),worker('/other/sw.js')]},
    {keys:async()=>['life-abroad-public-old','private-session','other-app-public'],delete:async name=>{removed.push(name);return true;}},'http://localhost:8082');
  assert.deepEqual(removed,['/sw.js','life-abroad-public-old']);
});
