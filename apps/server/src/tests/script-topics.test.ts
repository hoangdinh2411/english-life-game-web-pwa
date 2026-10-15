import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { loadSeedContent } from '../infrastructure/content/seed-content';
import { hasScriptTopic } from '../modules/dialogue/script-topics';

test('T10c every authored keyword and catalog item remains scripted; typo topics are caught without a topic list', async () => {
  const content = await loadSeedContent(resolve('../../content'));
  const keywords = content.dialogues.flatMap(file => file.nodes.flatMap(node => node.intents?.flatMap(intent => intent.keywords) ?? []));
  const items = content.shops.map(item => item.name);
  for (const text of [...keywords, ...items, 'I want a coffee', 'how much is the tea?', 'coffe plz two']) {
    assert.equal(hasScriptTopic(text, keywords, items), true, text);
  }
  assert.equal(hasScriptTopic('Do you like football?', keywords, items), false);
  assert.equal(hasScriptTopic('This is unrelated', ['hi'], []), false);
  assert.equal(hasScriptTopic('a quokka', [], ['quokka']), true, 'new catalog content is detected automatically');
});
