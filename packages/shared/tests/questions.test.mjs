import assert from 'node:assert/strict';
import test from 'node:test';
import { detectIntent, formatPlayerMessage, isDirectQuestion, stationReply } from '../dist/index.js';

test('greetings cannot swallow unsupported questions', () => {
  for (const input of ['hello what is the weather today', 'Hello! What is the weather today?', 'Hi, do you like astronomy?', 'Good morning. Where is the bank?']) {
    for (const step of [0, 1, 2]) {
      const reply = stationReply('npc_station_information', step, input);
      assert.equal(reply.aiFallback, true);
      assert.equal(reply.step, step);
      assert.equal(reply.correction, undefined);
      assert.ok(!reply.text.includes('ID card'));
    }
  }
  assert.equal(detectIntent('hello what is the weather today'), undefined);
  assert.equal(stationReply('npc_station_information', 0, 'hello').step, 1);
  assert.equal(stationReply('npc_station_information', 0, 'Hello! Where can I get an ID card?').directions, true);
});

test('direct questions gain punctuation without duplicating existing marks', () => {
  for (const input of ['Where can I get an ID card', 'Can you help me', 'How much is a ticket', 'Who works here']) {
    assert.equal(isDirectQuestion(input), true);
    assert.equal(formatPlayerMessage(input), `${input}?`);
  }
  assert.equal(formatPlayerMessage('hello what is the weather today'), 'Hello! What is the weather today?');
  assert.equal(formatPlayerMessage('Where is the bank.'), 'Where is the bank?');
  assert.equal(formatPlayerMessage('Hello! Where is the bank?'), 'Hello! Where is the bank?');
});

test('unpunctuated spoken statements followed by direct questions become separate sentences', () => {
  for (const input of ["Hello i'm new here what should i do now", "Hello i'm new here what should i do now.", "Hello i'm new here what should i do now?"]) {
    assert.equal(formatPlayerMessage(input), "Hello! I'm new here. What should I do now?");
    assert.equal(isDirectQuestion(input), true);
  }
  assert.equal(formatPlayerMessage('I need a ticket how much is it'), 'I need a ticket. How much is it?');
  assert.equal(formatPlayerMessage('Hi, I am new here. Where is the bank.'), 'Hi, I am new here. Where is the bank?');
  const formatted = "Hello! I'm new here. What should I do now?";
  assert.equal(formatPlayerMessage(formatted), formatted);
});

test('embedded and reported questions are not split into direct questions', () => {
  for (const input of ['I know what should happen now', 'I wonder what should I do now', 'I asked what should I do now', 'Tell me what should I do now', 'I am unsure what should happen', 'I need to know where is the bank', 'I said "what should I do now"']) {
    assert.equal(isDirectQuestion(input), false);
    assert.equal(formatPlayerMessage(input), input);
  }
});

test('statements, indirect questions and exclamations remain unchanged', () => {
  for (const input of ['Hello!', 'I need an ID card.', 'I wonder where the bank is', 'What a lovely day!', 'I know how much it costs', 'My journey was good', 'Can you help? Thanks.']) {
    assert.equal(isDirectQuestion(input), false);
    assert.equal(formatPlayerMessage(input), input);
  }
});
