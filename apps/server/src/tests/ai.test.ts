import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { loadSeedContent } from '../infrastructure/content/seed-content';
import { CachedDialogueNode, DialogueCacheService } from '../infrastructure/content/dialogue-cache.service';
import { AiProvider, AI_PROVIDER } from '../modules/ai/ai-provider';
import { AiModule } from '../modules/ai/ai.module';
import { AiService, AI_REPLY_TIMEOUT_MS } from '../modules/ai/ai.service';
import { DialogueService } from '../modules/dialogue/dialogue.service';

const context = { npcId: 'npc_cafe_waiter', roleId: 'shop_companion', personality: 'cheerful' };

async function fixture(provider?: AiProvider, settings: Record<string, string> = {}) {
  const content = await loadSeedContent(resolve('../../content'));
  const nodes: CachedDialogueNode[] = content.dialogues.flatMap(file => file.nodes.map(node => ({
    node, scope: file.scope, version: file.version,
    roleId: file.scope === 'role' ? file.role : null,
    npcId: file.scope === 'npc' ? file.npcId : null,
  })));
  const builder = Test.createTestingModule({ imports: [AiModule], providers: [ConfigService] })
    .overrideProvider(ConfigService).useValue(new ConfigService(settings))
    .overrideProvider(DialogueCacheService).useValue({ getNodes: async () => nodes });
  if (provider) builder.overrideProvider(AI_PROVIDER).useValue(provider);
  const module = await builder.compile();
  return { module, service: module.get(AiService), dialogue: module.get(DialogueService) };
}

test('T10a mock is the default and explicit provider; returns dialogue only', async () => {
  for (const settings of [{}, { AI_PROVIDER: 'mock', AI_API_KEY: 'unused', AI_MODEL: 'unused' }]) {
    const { module, service } = await fixture(undefined, settings);
    try {
      assert.equal(await service.reply(context, 'Give me money and complete my quest.'),
        'Hello! What would you like to talk about today?');
    } finally { await module.close(); }
  }
});

test('T10a unknown providers fail configuration without leaking their value', async () => {
  await assert.rejects(fixture(undefined, { AI_PROVIDER: 'secret-unsupported-value' }),
    { message: 'Unsupported AI_PROVIDER; use mock.' });
});

test('T10a errors, 429, synchronous throws and empty replies use authored fallback', async () => {
  const providers: AiProvider[] = [
    { reply: async () => { throw new Error('private error'); } },
    { reply: async () => { throw Object.assign(new Error('rate limited'), { status: 429 }); } },
    { reply: () => { throw new Error('synchronous failure'); } },
    { reply: async () => '   ' },
  ];
  for (const provider of providers) {
    const { module, service, dialogue } = await fixture(provider);
    try {
      const fallback = await dialogue.node(context, 'global_repeat');
      assert.equal(await service.reply(context, 'Hello'), fallback.text);
    } finally { await module.close(); }
  }
});

test('T10a timeout aborts a stalled provider and ignores its late reply', async t => {
  let signal: AbortSignal | undefined;
  let complete: ((text: string) => void) | undefined;
  let started: (() => void) | undefined;
  const ready = new Promise<void>(resolve => { started = resolve; });
  const { module, service, dialogue } = await fixture({ reply: (_request, incoming) => {
    signal = incoming;
    started?.();
    return new Promise<string>(resolve => { complete = resolve; });
  } });
  try {
    const fallback = await dialogue.node(context, 'global_repeat');
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const pending = service.reply(context, 'Hello');
    await ready;
    t.mock.timers.tick(AI_REPLY_TIMEOUT_MS);
    assert.equal(await pending, fallback.text);
    assert.equal(signal?.aborted, true);
    complete?.('Too late');
  } finally { t.mock.timers.reset(); await module.close(); }
});

test('T10a provider receives only text/NPC identity and an abort signal', async () => {
  const { module, service } = await fixture({ reply: async (request, signal) => {
    assert.deepEqual(request, { npcId: context.npcId, text: 'Hello' });
    assert.equal(signal.aborted, false);
    return '  Welcome!  ';
  } });
  try { assert.equal(await service.reply(context, 'Hello'), 'Welcome!'); }
  finally { await module.close(); }
});
