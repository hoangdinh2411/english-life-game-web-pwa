import assert from 'node:assert/strict';
import test from 'node:test';
import { ConfigService } from '@nestjs/config';
import { AzureSpeechProvider, resolveAzureStyle } from '../modules/speech/azure-speech.provider';

const settings = new ConfigService({ AZURE_SPEECH_REGION: 'swedencentral', AZURE_SPEECH_KEY: 'secret-test-key' });

test('maps all NPC emotions and falls back when a voice lacks the requested style', () => {
  assert.equal(resolveAzureStyle('neutral', ['cheerful', 'sad']), 'default');
  assert.equal(resolveAzureStyle('happy', ['cheerful']), 'cheerful');
  assert.equal(resolveAzureStyle('sad', ['sad']), 'sad');
  assert.equal(resolveAzureStyle('happy', ['sad']), 'default');
});

test('Azure speech escapes SSML, applies supported emotion styles, and returns generation metadata', async () => {
  let requestBody = '';
  let requestHeaders: RequestInit['headers'];
  const request: typeof fetch = async (_input, init) => {
    requestBody = String(init?.body ?? ''); requestHeaders = init?.headers;
    return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'audio/mpeg' } });
  };
  const provider = new AzureSpeechProvider(settings, request);
  const result = await provider.synthesize({ text: `Great <day> & welcome "friend"!`, voice: 'en-US-GuyNeural',
    emotion: 'happy', supportedStyles: ['cheerful', 'sad'] });
  assert.match(requestBody, /mstts:express-as style="cheerful"/);
  assert.match(requestBody, /Great &lt;day&gt; &amp; welcome &quot;friend&quot;!/);
  assert.ok(!requestBody.includes('secret-test-key'));
  assert.equal(new Headers(requestHeaders).get('Ocp-Apim-Subscription-Key'), 'secret-test-key');
  assert.deepEqual(result.metadata, { provider: 'azure', version: 'rest-v1', language: 'en-US', voice: 'en-US-GuyNeural',
    emotion: 'happy', style: 'cheerful', format: 'audio-24khz-48kbitrate-mono-mp3' });
  assert.deepEqual(result.audio, Buffer.from([1, 2, 3]));
  assert.ok(!JSON.stringify(result.metadata).includes('secret-test-key'));
});

test('neutral and unsupported emotion styles use default SSML without express-as', async () => {
  const bodies: string[] = [];
  const provider = new AzureSpeechProvider(settings, async (_input, init) => {
    bodies.push(String(init?.body ?? ''));
    return new Response(new Uint8Array([1]), { status: 200, headers: { 'content-type': 'audio/mpeg' } });
  });
  const neutral = await provider.synthesize({ text: 'Hello.', voice: 'en-US-AndrewNeural', emotion: 'neutral', supportedStyles: [] });
  const unsupported = await provider.synthesize({ text: 'I am sorry.', voice: 'en-US-AndrewNeural', emotion: 'sad', supportedStyles: [] });
  assert.equal(neutral.metadata.style, 'default');
  assert.equal(unsupported.metadata.style, 'default');
  assert.ok(bodies.every(body => !body.includes('express-as')));
});

test('Azure speech configuration and provider failures do not expose secrets', async () => {
  await assert.rejects(new AzureSpeechProvider(new ConfigService()).synthesize({
    text: 'Hello.', voice: 'en-US-AvaNeural', emotion: 'neutral', supportedStyles: [],
  }), { message: 'Azure Speech requires a valid region and key.' });
  const provider = new AzureSpeechProvider(settings, async () => new Response('private provider details', { status: 500 }));
  await assert.rejects(provider.synthesize({ text: 'Hello.', voice: 'en-US-AvaNeural', emotion: 'neutral', supportedStyles: [] }),
    error => error instanceof Error && error.message === 'Azure speech generation failed.'
      && !error.message.includes('secret-test-key') && !error.message.includes('private provider details'));
});

test('Azure speech cancels a slow provider before the conversation client deadline', async () => {
  let aborted = false;
  const provider = new AzureSpeechProvider(settings, (_input, init) => new Promise<Response>((_resolve, reject) => {
    const signal = init?.signal;
    if (!signal) throw new Error('Expected an abort signal.');
    signal.addEventListener('abort', () => { aborted = true; reject(new Error('request aborted')); }, { once: true });
  }), 1);

  await assert.rejects(provider.synthesize({ text: 'Hello.', voice: 'en-US-AvaNeural', emotion: 'neutral', supportedStyles: [] }),
    { message: 'Azure speech generation failed.' });
  assert.equal(aborted, true);
});
