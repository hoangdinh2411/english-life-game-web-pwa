import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ConfigService } from '@nestjs/config';
import { GeminiProvider } from '../modules/ai/gemini.provider';
import { NPC_SYSTEM_PROMPT } from '../modules/ai/prompts';

const settings = new ConfigService({ AI_API_KEY: 'test-key', AI_MODEL: 'test-model' });
const input = { npcId: 'npc_mila_florist', text: 'What is your favorite season?' };
const response = (parts: unknown[], finishReason = 'STOP'): Response => Response.json({
  candidates: [{ finishReason, content: { parts } }],
});

test('T10b Gemini uses configured model, header authentication, centralized prompts and cancellation', async () => {
  const controller = new AbortController();
  const provider = new GeminiProvider(settings, async (url, init) => {
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/test-model:generateContent');
    assert.equal(init?.method, 'POST');
    assert.equal(init.signal, controller.signal);
    assert.deepEqual(init.headers, { 'Content-Type': 'application/json', 'x-goog-api-key': 'test-key' });
    const body: unknown = JSON.parse(String(init.body));
    assert.deepEqual(body, {
      system_instruction: { parts: [{ text: NPC_SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: `Resident: ${input.npcId}\nPlayer message: ${input.text}` }] }],
    });
    return response([{ text: 'Internal thought', thought: true }, { text: ' Spring ' }, { text: 'is lovely! ' }]);
  });
  assert.equal(await provider.reply(input, controller.signal), 'Spring is lovely!');
});

test('T10b malformed, blocked, empty, incomplete and HTTP failures reject for scripted fallback', async () => {
  const replies = [
    new Response('private provider error', { status: 429 }),
    new Response('private provider error', { status: 500 }),
    new Response('not JSON'), Response.json(null), Response.json({}),
    Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [null, 12] } }] }),
    response([{ text: 'partial reply' }], 'MAX_TOKENS'),
    response([{ text: 'blocked reply' }], 'SAFETY'), response([{ text: '  ' }]),
    response([{ text: 'private thought', thought: true }]),
  ];
  for (const reply of replies) {
    const provider = new GeminiProvider(settings, async () => reply);
    await assert.rejects(provider.reply(input, new AbortController().signal));
  }
});

test('T10c Gemini consumes the provider-neutral persona and history without adding identifiers', async () => {
  const provider = new GeminiProvider(settings, async (_url, init) => {
    const body: unknown = JSON.parse(String(init?.body));
    assert.deepEqual(body, {
      system_instruction: { parts: [{ text: 'Persona and levels' }] },
      contents: [
        { role: 'user', parts: [{ text: 'Earlier question' }] },
        { role: 'model', parts: [{ text: 'Earlier reply' }] },
        { role: 'user', parts: [{ text: 'Football?' }] },
      ],
    });
    return response([{ text: 'Yes!' }]);
  });
  assert.equal(await provider.reply({ npcId: 'npc_mia', text: 'Football?', prompt: {
    system: 'Persona and levels', history: [{ speaker: 'player', text: 'Earlier question' }, { speaker: 'npc', text: 'Earlier reply' }],
  } }, new AbortController().signal), 'Yes!');
});

test('T10b requires explicit key and model without exposing configuration values', () => {
  for (const values of [{}, { AI_API_KEY: 'secret' }, { AI_MODEL: 'model' },
    { AI_API_KEY: 'secret', AI_MODEL: '../invalid?key=secret' }]) {
    assert.throws(() => new GeminiProvider(new ConfigService(values)),
      { message: 'Gemini requires AI_API_KEY and a valid AI_MODEL.' });
  }
});

test('T10b forwards network failures and aborts without retries', async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  const provider = new GeminiProvider(settings, async (_url, init) => {
    calls++;
    init?.signal?.throwIfAborted();
    throw new Error('network failed');
  });
  await assert.rejects(provider.reply(input, controller.signal));
  assert.equal(calls, 1);
});
