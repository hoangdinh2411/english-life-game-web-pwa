import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpeechInput } from '../src/speech/speech-input.ts';
function harness(factory) {
  const events = [];
  const input = createSpeechInput(factory, { onListening: (value) => events.push(['listening', value]), onTranscript: (value) => events.push(['final', value]), onInterim: (value) => events.push(['interim', value]), onError: (value) => events.push(['error', value]) });
  return { events, input };
}
test('unsupported speech keeps typed fallback and never submits a message', () => {
  const { input, events } = harness(() => null); input.start();
  assert.match(events.find(([type]) => type === 'error')[1], /type/);
  assert.equal(events.some(([type]) => type === 'final'), false);
});
test('speech separates interim/final text and ignores late callbacks after cancellation', () => {
  const recognizer = { start() {}, abort() { this.aborted = true; } };
  const { input, events } = harness(() => recognizer); input.start();
  recognizer.onresult({ results: [{ isFinal: false, 0: { transcript: 'hel' } }] });
  assert.equal(events.some(([type]) => type === 'final'), false);
  recognizer.onresult({ results: [{ isFinal: true, 0: { transcript: 'hello' } }] });
  const late = recognizer.onresult; input.stop();
  late({ results: [{ isFinal: true, 0: { transcript: 'late' } }] });
  assert.equal(recognizer.aborted, true);
  assert.deepEqual(events.filter(([type]) => type === 'final'), [['final', 'hello']]);
});
test('permission and network errors end listening with a readable fallback', () => {
  for (const error of ['not-allowed', 'network']) {
    const recognizer = { start() {}, abort() {} };
    const { input, events } = harness(() => recognizer); input.start(); recognizer.onerror({ error });
    assert.match(events.find(([type]) => type === 'error')[1], /type/);
    assert.ok(events.some(([type, value]) => type === 'listening' && value === false));
  }
});
test('normal session endings restart recording and preserve transcripts without duplication', async () => {
  const recognizers = [];
  const { input, events } = harness(() => {
    const recognizer = { start() {}, stop() { this.onend(); }, abort() {} };
    recognizers.push(recognizer); return recognizer;
  });
  input.start();
  assert.equal(recognizers[0].continuous, true);
  recognizers[0].onresult({ results: [{ isFinal: true, 0: { transcript: 'Hello' } }] });
  recognizers[0].onresult({ results: [{ isFinal: true, 0: { transcript: 'Hello' } }, { isFinal: true, 0: { transcript: "I'm new here" } }] });
  const late = recognizers[0].onresult;
  recognizers[0].onend();
  await new Promise(resolve => globalThis.setTimeout(resolve, 150));
  assert.equal(recognizers.length, 2);
  late({ results: [{ isFinal: true, 0: { transcript: 'stale' } }] });
  recognizers[1].onresult({ results: [{ isFinal: true, 0: { transcript: 'What should I do now' } }] });
  assert.deepEqual(events.at(-2), ['final', "Hello I'm new here What should I do now"]);
  assert.equal(events.filter(([type, value]) => type === 'listening' && value === false).length, 1);
  input.finish();
  await new Promise(resolve => globalThis.setTimeout(resolve, 150));
  assert.equal(recognizers.length, 2);
  assert.deepEqual(events.filter(([type]) => type === 'listening').at(-1), ['listening', false]);
});
test('silence does not end recording, and Close cancels a scheduled restart', async () => {
  let count = 0;
  const recognizer = { start() {}, abort() {} };
  const { input, events } = harness(() => { count++; return recognizer; });
  input.start(); recognizer.onerror({ error: 'no-speech' }); recognizer.onend();
  assert.equal(events.some(([type]) => type === 'error'), false);
  input.stop();
  await new Promise(resolve => globalThis.setTimeout(resolve, 150));
  assert.equal(count, 1);
});
test('Stop during a pause cancels restarting and keeps the finalized transcript', async () => {
  let count = 0;
  const recognizer = { start() {}, abort() {} };
  const { input, events } = harness(() => { count++; return recognizer; });
  input.start();
  recognizer.onresult({ results: [{ isFinal: true, 0: { transcript: 'I need a ticket' } }] });
  recognizer.onend(); input.finish();
  await new Promise(resolve => globalThis.setTimeout(resolve, 150));
  assert.equal(count, 1);
  assert.deepEqual(events.filter(([type]) => type === 'final'), [['final', 'I need a ticket']]);
  assert.deepEqual(events.filter(([type]) => type === 'listening').at(-1), ['listening', false]);
});
test('no-speech restarts recognition without dropping the listening state', async () => {
  const recognizers = [];
  const { input, events } = harness(() => {
    const recognizer = { start() {}, abort() {} };
    recognizers.push(recognizer); return recognizer;
  });
  input.start(); recognizers[0].onerror({ error: 'no-speech' }); recognizers[0].onend();
  await new Promise(resolve => globalThis.setTimeout(resolve, 150));
  assert.equal(recognizers.length, 2);
  assert.deepEqual(events.filter(([type]) => type === 'listening').at(-1), ['listening', true]);
  assert.equal(events.some(([type]) => type === 'error'), false);
  input.stop();
});
test('Stop recording finalizes the transcript while Close aborts it', () => {
  const recognizer = { start() {}, stop() { this.onresult({ results: [{ isFinal: true, 0: { transcript: 'Hello there' } }] }); this.onend(); }, abort() { this.aborted = true; } };
  const { input, events } = harness(() => recognizer); input.start(); input.finish();
  assert.deepEqual(events.filter(([type]) => type === 'final'), [['final', 'Hello there']]);
  input.start(); input.stop(); assert.equal(recognizer.aborted, true);
});
test('Send waits for the final words, stops restarting, and resolves one complete transcript', async () => {
  const recognizer = { start() {}, stop() { this.stopped = true; }, abort() {} };
  const { input } = harness(() => recognizer);
  input.start();
  recognizer.onresult({ results: [{ isFinal: true, 0: { transcript: 'Hello' } }, { isFinal: false, 0: { transcript: 'I am new' } }] });
  const sent = input.finish();
  assert.equal(input.finish(), sent);
  let resolved = false;
  sent.then(() => { resolved = true; });
  await Promise.resolve();
  assert.equal(resolved, false);
  assert.equal(recognizer.stopped, true);
  recognizer.onresult({ results: [{ isFinal: true, 0: { transcript: 'Hello' } }, { isFinal: true, 0: { transcript: 'I am new here' } }] });
  recognizer.onend();
  assert.equal(await sent, 'Hello I am new here');
});
test('cancelled or failed finalization never provides a message to send', async () => {
  const recognizer = { start() {}, stop() {}, abort() {} };
  const { input } = harness(() => recognizer);
  input.start(); const sent = input.finish(); input.stop();
  assert.equal(await sent, null);
  input.start(); const failed = input.finish(); recognizer.onerror({ error: 'network' });
  assert.equal(await failed, null);
});

