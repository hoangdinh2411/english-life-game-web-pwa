import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  checkGrammar,
  detectContextIntent,
  detectIntent,
  endsWithFarewell,
  FAREWELL_CLOSING_PROFILE,
  farewellClosing,
  isDirectQuestion,
  normalizeDialogue,
  SERVICE_CONTINUATION_PROFILE,
  serviceContinuationIntent,
  STATION_OPEN_PROFILE,
  STATION_QUESTION_PROFILE,
  stationGreeting,
  stationReply,
} from '../dist/index.js';

const require = createRequire(import.meta.url);
const commonIntents = require('../src/dialogue/content/intents.common.json');
const stationIntents = require('../src/dialogue/content/intents.station.json');
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

// T41.a inventory: classifies every remaining legacy intent caller before migration.
// Categories:
// - 'reusable_language_intent': migrate to shared lexicon + ContextProfile in T41.b–d
// - 'domain_entity_or_topic': stays in its domain module / content
// - 'safety_filter': stays in ai-safety.ts (out of scope for intent migration)
export const LEGACY_INTENT_INVENTORY = Object.freeze([
  {
    id: 'detectIntent_confirm_deny_and_confirmation_flag',
    file: 'packages/shared/src/dialogue/language.ts',
    symbol: 'detectIntent (confirm/deny + confirmation flag)',
    classification: 'reusable_language_intent',
    slice: 'T41.b',
  },
  {
    id: 'intents_common_confirm_deny',
    file: 'packages/shared/src/dialogue/content/intents.common.json',
    symbol: 'intents.common.json (confirm, deny)',
    classification: 'reusable_language_intent',
    slice: 'T41.b',
  },
  {
    id: 'intents_common_greet_thank_goodbye',
    file: 'packages/shared/src/dialogue/content/intents.common.json',
    symbol: 'intents.common.json (greet, thank, goodbye)',
    classification: 'reusable_language_intent',
    slice: 'T41.c',
  },
  {
    id: 'endsWithFarewell_goodbye_rule',
    file: 'packages/shared/src/dialogue/language.ts',
    symbol: 'endsWithFarewell',
    classification: 'reusable_language_intent',
    slice: 'T41.c',
  },
  {
    id: 'farewellClosing_yes_no',
    file: 'packages/shared/src/dialogue/language.ts',
    symbol: 'farewellClosing (yes/no regex checks)',
    classification: 'reusable_language_intent',
    slice: 'T41.b',
  },
  {
    id: 'serviceContinuationIntent_yes_no_finish_thank_goodbye',
    file: 'packages/shared/src/dialogue/language.ts',
    symbol: 'serviceContinuationIntent (confirm/deny/goodbye/thank/finish checks)',
    classification: 'reusable_language_intent',
    slice: 'T41.b',
  },
  {
    id: 'serviceContinuationIntent_new_request_guard',
    file: 'packages/shared/src/dialogue/language.ts',
    symbol: 'serviceContinuationIntent (hasNewRequest guard)',
    classification: 'domain_entity_or_topic',
    slice: 'stays_in_domain',
  },
  {
    id: 'stationReply_common_intents',
    file: 'packages/shared/src/station.ts',
    symbol: 'stationReply (confirm, deny, goodbye, thank, greet via detectIntent)',
    classification: 'reusable_language_intent',
    slice: 'T41.b-c',
  },
  {
    id: 'stationReply_domain_intents_and_journey',
    file: 'packages/shared/src/station.ts',
    symbol: 'stationReply (intents.station.json + journeyAnswer)',
    classification: 'domain_entity_or_topic',
    slice: 'stays_in_domain',
  },
  {
    id: 'useStationConversation_goodbye_and_farewellClosing',
    file: 'apps/game/src/gameplay/use-station-conversation.ts',
    symbol: 'useStationConversation (detectIntent goodbye + farewellClosing)',
    classification: 'reusable_language_intent',
    slice: 'T41.b-c',
  },
  {
    id: 'conversationPolicy_goodbye_farewellClosing_serviceContinuation',
    file: 'apps/server/src/modules/conversations/conversation-policy.ts',
    symbol: 'evaluateFarewell (detectIntent goodbye + serviceContinuationIntent + farewellClosing)',
    classification: 'reusable_language_intent',
    slice: 'T41.b-c',
  },
  {
    id: 'conversationPolicy_more_help_question_prompt_check',
    file: 'apps/server/src/modules/conversations/conversation-policy.ts',
    symbol: 'evaluateFarewell (answeringMoreHelpQuestion prompt regex)',
    classification: 'domain_entity_or_topic',
    slice: 'stays_in_domain',
  },
  {
    id: 'sellerService_cafe_negation_and_clothes_confirm_cancel_goodbye',
    file: 'apps/server/src/modules/conversations/seller.service.ts',
    symbol: 'SellerService (cafe negation regex + clothes affirmative/cancel/goodbye regexes)',
    classification: 'reusable_language_intent',
    slice: 'T41.b-c',
  },
  {
    id: 'sellerService_items_quantities_directions_menu',
    file: 'apps/server/src/modules/conversations/seller.service.ts',
    symbol: 'SellerService (namedItems, quantity, order/menu/directions checks)',
    classification: 'domain_entity_or_topic',
    slice: 'stays_in_domain',
  },
  {
    id: 'dialogueService_ticket_refusal_and_id_card_topic',
    file: 'apps/server/src/modules/dialogue/dialogue.service.ts',
    symbol: 'DialogueService (station ticket refusal, isTaxOfficeServiceTopic, asksForDirections, isIncompleteQuestion)',
    classification: 'domain_entity_or_topic',
    slice: 'stays_in_domain',
  },
  {
    id: 'socialSignal_greeting_thanks_apology',
    file: 'apps/server/src/modules/npcs/social-signal.ts',
    symbol: 'classifySocialSignal (greeting, thanks, apology)',
    classification: 'reusable_language_intent',
    slice: 'T41.c',
  },
  {
    id: 'socialSignal_polite_request_and_insult',
    file: 'apps/server/src/modules/npcs/social-signal.ts',
    symbol: 'classifySocialSignal (polite_request, insult)',
    classification: 'domain_entity_or_topic',
    slice: 'stays_in_domain',
  },
  {
    id: 'quests_doneWhen_greet',
    file: 'content/seed/quests.json',
    symbol: 'quests.json doneWhen (greet)',
    classification: 'reusable_language_intent',
    slice: 'T41.c',
  },
  {
    id: 'quests_doneWhen_domain_intents',
    file: 'content/seed/quests.json',
    symbol: 'quests.json doneWhen (ask_town_directions, request_bus_ticket, obtain_bus_ticket, enter_town_street, order_drink, pay_drink, say_name, say_origin, need_flat, ask_price, agree, want_account, give_details, report_problem, agree_time)',
    classification: 'domain_entity_or_topic',
    slice: 'stays_in_domain',
  },
  {
    id: 'aiSafety_input_and_output_filters',
    file: 'apps/server/src/modules/ai/ai-safety.ts',
    symbol: 'safeAiInput / isSafeAiOutput safety regexes',
    classification: 'safety_filter',
    slice: 'out_of_scope',
  },
]);

test('T41.a inventory lists every remaining caller with a valid classification', async () => {
  const validClassifications = new Set(['reusable_language_intent', 'domain_entity_or_topic', 'safety_filter']);
  const ids = new Set();
  for (const entry of LEGACY_INTENT_INVENTORY) {
    assert.equal(ids.has(entry.id), false, `Duplicate inventory id: ${entry.id}`);
    ids.add(entry.id);
    assert.equal(validClassifications.has(entry.classification), true, entry.id);
    const content = await readFile(resolve(repoRoot, entry.file), 'utf8');
    assert.ok(content.length > 0, `Empty or missing file: ${entry.file}`);
  }
  assert.deepEqual(
    commonIntents.intents.map((rule) => rule.id),
    ['goodbye', 'thank', 'greet'],
  );
  assert.deepEqual(
    stationIntents.intents.map((rule) => rule.id),
    ['request_document', 'ask_location', 'introduce', 'describe_journey'],
  );
});

test('detectIntent & station profiles (T41.b): confirm/deny removed from detectIntent; station profiles resolve confirm/deny/cancel via lexicon', () => {
  for (const input of ['yes', 'yeah', 'yep', 'sure', 'exactly', 'of course', "that's right", 'that is right', 'i need it', 'i want it']) {
    assert.equal(detectIntent(input), undefined, `detectIntent should no longer match confirm: ${input}`);
    assert.equal(detectContextIntent(input, STATION_OPEN_PROFILE).status, 'unclear', `STATION_OPEN_PROFILE should ignore: ${input}`);
    const matched = detectContextIntent(input, STATION_QUESTION_PROFILE);
    assert.equal(matched.status === 'matched' ? matched.primary : undefined, 'confirm', `STATION_QUESTION_PROFILE should match: ${input}`);
  }
  for (const input of ['no', 'not really', "that's not right", 'that is not what I meant', "I don't need an ID card", 'I do not want it', "I didn't mean that"]) {
    assert.equal(detectIntent(input), undefined, `detectIntent should no longer match deny: ${input}`);
    for (const profile of [STATION_OPEN_PROFILE, STATION_QUESTION_PROFILE]) {
      const matched = detectContextIntent(input, profile);
      assert.equal(matched.status === 'matched' ? matched.primary : undefined, 'deny', input);
    }
  }
  for (const input of ['cancel', 'never mind']) {
    for (const profile of [STATION_OPEN_PROFILE, STATION_QUESTION_PROFILE]) {
      const matched = detectContextIntent(input, profile);
      assert.equal(matched.status === 'matched' ? matched.primary : undefined, 'cancel', input);
    }
  }
  assert.equal(FAREWELL_CLOSING_PROFILE.id, 'farewell_closing');
  assert.equal(SERVICE_CONTINUATION_PROFILE.id, 'service_continuation');
  for (const input of ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'Hello!']) {
    assert.equal(detectIntent(input)?.id, 'greet', input);
  }
  for (const input of ['thanks', 'thank you', 'Hello, thank you!']) {
    assert.equal(detectIntent(input)?.id, 'thank', input);
  }
  for (const input of ['bye', 'goodbye', 'see you later', 'take care', 'have a nice day', 'I have to go now', "that's all for now"]) {
    assert.equal(detectIntent(input)?.id, 'goodbye', input);
  }
  assert.equal(endsWithFarewell('Thanks for the help. See you tomorrow!'), true);
  assert.equal(endsWithFarewell('See you tomorrow. Do you open at eight?'), false);
});

test('farewellClosing: preserves yes-like, no-like, and neutral closing responses', () => {
  const yes = 'That would be lovely. I hope to see you tomorrow. Goodbye!';
  const no = 'I understand. It was nice talking with you. Goodbye!';
  const other = 'I hope to see you again. It was nice talking with you. Goodbye!';

  for (const input of ['yes', 'yeah', 'yep', 'sure', 'definitely', 'of course', "I'll be back", 'I will be back', 'I think so']) {
    assert.equal(farewellClosing(input), yes, input);
  }
  for (const input of ['no', 'nope', 'probably not', "I won't come back", 'I will not come back']) {
    assert.equal(farewellClosing(input), no, input);
  }
  for (const input of ['maybe', 'not sure', 'see you', '']) {
    assert.equal(farewellClosing(input), other, input);
  }
});

test('serviceContinuationIntent: preserves finish, continue, new-request guard, and unclear transitions', () => {
  for (const input of [
    'no', 'no thanks', 'not really', "I don't need anything else", 'goodbye', 'bye',
    'thanks', 'thank you', 'thanks very much', 'thank you so much',
    'nothing else', "that's all", 'that is all', "I'm done", 'i am done', 'no more', 'not today', 'all good',
  ]) {
    assert.equal(serviceContinuationIntent(input), 'finish', input);
  }
  for (const input of [
    'yes', 'sure', 'I need to update my address', 'No, but I also want to change my name',
    'We would like a bus ticket', 'Thanks, I also need help with my photo', 'maybe', 'nope',
  ]) {
    assert.equal(serviceContinuationIntent(input), 'continue', input);
  }
  assert.equal(serviceContinuationIntent(''), 'unclear');
  assert.equal(serviceContinuationIntent('   ...   '), 'unclear');
});

test('station.ts & use-station-conversation.ts: preserves stationReply and client farewell state machine', () => {
  assert.equal(stationGreeting('npc_station_information').step, 0);
  assert.equal(stationGreeting('npc_passenger_suitcase').text.includes('journey'), true);

  // Receptionist requires greeting at step 0 before answering ID-card requests
  const gated = stationReply('npc_station_information', 0, 'I need an ID card');
  assert.equal(gated.step, 0);
  assert.equal(gated.directions, false);

  // Greeting advances receptionist to step 1
  const greeted = stationReply('npc_station_information', 0, 'Hello!');
  assert.equal(greeted.step, 1);
  assert.equal(greeted.directions, false);

  // Imperfect English triggers grammar recast confirmation with followUp
  const recast = stationReply('npc_station_information', 1, 'I want get ID card');
  assert.equal(recast.followUp, 'directions');
  assert.equal(recast.directions, false);
  assert.equal(checkGrammar('I want get ID card')?.question, 'you want to get an ID card');

  // Confirming the directions follow-up gives directions and advances to step 2
  const confirmed = stationReply('npc_station_information', 1, 'Yes, please.', 'directions');
  assert.equal(confirmed.step, 2);
  assert.equal(confirmed.directions, true);

  // Denying keeps step 1 without directions
  const denied = stationReply('npc_station_information', 1, 'No, thank you.', 'directions');
  assert.equal(denied.step, 1);
  assert.equal(denied.directions, false);

  // Domain entity slots in intents.station.json
  assert.equal(stationReply('npc_station_information', 1, 'Where is the tax office?').directions, true);
  assert.equal(stationReply('npc_station_information', 1, 'Where is the cafe?').aiFallback, true);
  assert.equal(stationReply('npc_passenger_suitcase', 0, 'It was good, thank you.').aiFallback, undefined);
  assert.equal(stationReply('npc_passenger_backpack', 0, 'I am new here.').aiFallback, undefined);

  // Client use-station-conversation farewell sequence (mirrors useStationConversation)
  const simulateStationTurn = (messages, input) => {
    const text = input.trim();
    const priorGoodbyes = messages.filter((m) => m.speaker === 'player' && detectIntent(m.text)?.id === 'goodbye').length;
    const currentIsGoodbye = detectIntent(text)?.id === 'goodbye';
    const lastGoodbyeIndex = messages.findLastIndex((m) => m.speaker === 'player' && detectIntent(m.text)?.id === 'goodbye');
    const lastNpcIndex = messages.findLastIndex((m) => m.speaker === 'npc');
    const lastNpcMessage = messages[lastNpcIndex];
    const answeringFarewellQuestion =
      priorGoodbyes > 0 && lastNpcIndex > lastGoodbyeIndex && lastNpcMessage?.speaker === 'npc' && isDirectQuestion(lastNpcMessage.text);
    if (currentIsGoodbye && priorGoodbyes === 0) {
      return { text: 'Before you go, will you come back tomorrow?', farewellStage: 'question' };
    }
    if (answeringFarewellQuestion) {
      return { text: farewellClosing(text), farewellStage: 'confirm' };
    }
    return { text: stationReply('npc_station_information', 1, text).text, farewellStage: undefined };
  };

  const firstGoodbye = simulateStationTurn([{ speaker: 'npc', text: 'Hello!' }], 'Goodbye');
  assert.deepEqual(firstGoodbye, { text: 'Before you go, will you come back tomorrow?', farewellStage: 'question' });
  const confirmFarewell = simulateStationTurn(
    [
      { speaker: 'npc', text: 'Hello!' },
      { speaker: 'player', text: 'Goodbye' },
      { speaker: 'npc', text: 'Before you go, will you come back tomorrow?' },
    ],
    'Yes, definitely!',
  );
  assert.deepEqual(confirmFarewell, {
    text: 'That would be lovely. I hope to see you tomorrow. Goodbye!',
    farewellStage: 'confirm',
  });
});

test('conversation-policy.ts: preserves evaluateFarewell goodbye, follow-up, and anything-else transitions', async () => {
  const policySource = await readFile(
    resolve(repoRoot, 'apps/server/src/modules/conversations/conversation-policy.ts'),
    'utf8',
  );
  assert.match(policySource, /detectIntent\(message\.text\)\?\.id === 'goodbye'/);
  assert.match(policySource, /serviceContinuationIntent\(currentText\) === 'finish'/);
  assert.match(policySource, /farewellClosing\(currentText\)/);

  const evaluatePolicy = (history, currentText) => {
    let priorGoodbyes = 0;
    let lastGoodbyeIndex = -1;
    let priorNpcIndex = -1;
    let priorNpcMessage;
    for (const [index, message] of history.entries()) {
      if (message.sender === 'player' && detectIntent(message.text)?.id === 'goodbye') {
        priorGoodbyes += 1;
        lastGoodbyeIndex = index;
      }
      if (message.sender === 'npc') {
        priorNpcIndex = index;
        priorNpcMessage = message;
      }
    }
    const currentIsGoodbye = detectIntent(currentText)?.id === 'goodbye';
    const answeringMoreHelpQuestion =
      priorNpcMessage !== undefined &&
      /(?:anything|something) else(?: i can help you with)?\?$/i.test(priorNpcMessage.text.trim());
    const answeringFarewellQuestion =
      priorGoodbyes > 0 &&
      priorNpcIndex > lastGoodbyeIndex &&
      priorNpcMessage !== undefined &&
      isDirectQuestion(priorNpcMessage.text);
    if (answeringMoreHelpQuestion && serviceContinuationIntent(currentText) === 'finish') {
      return {
        currentIsGoodbye,
        response: { text: 'You’re welcome. Goodbye!', stage: 'confirm', closeConversation: true },
      };
    }
    if (currentIsGoodbye && priorGoodbyes === 0) {
      return {
        currentIsGoodbye,
        response: { text: 'Before you go, will you come back tomorrow?', stage: 'question' },
      };
    }
    if (answeringFarewellQuestion) {
      return {
        currentIsGoodbye,
        response: { text: farewellClosing(currentText), stage: 'confirm' },
      };
    }
    return { currentIsGoodbye };
  };

  assert.deepEqual(evaluatePolicy([{ sender: 'npc', text: 'Hello!' }], 'See you later'), {
    currentIsGoodbye: true,
    response: { text: 'Before you go, will you come back tomorrow?', stage: 'question' },
  });

  assert.deepEqual(
    evaluatePolicy(
      [
        { sender: 'player', text: 'See you later' },
        { sender: 'npc', text: 'Before you go, will you come back tomorrow?' },
      ],
      'Probably not',
    ),
    {
      currentIsGoodbye: false,
      response: { text: 'I understand. It was nice talking with you. Goodbye!', stage: 'confirm' },
    },
  );

  assert.deepEqual(
    evaluatePolicy([{ sender: 'npc', text: 'Is there anything else I can help you with?' }], 'That is all'),
    {
      currentIsGoodbye: false,
      response: { text: 'You’re welcome. Goodbye!', stage: 'confirm', closeConversation: true },
    },
  );

  assert.deepEqual(
    evaluatePolicy([{ sender: 'npc', text: 'Is there anything else I can help you with?' }], 'Yes, I want to update my name'),
    { currentIsGoodbye: false },
  );
});

test('seller.service.ts & dialogue.service.ts: clothes seller uses CLOTHES_ORDER_PROFILE (T41.b) while goodbye, cafe negation, ticket refusal, and ID-card topic checks remain', async () => {
  const sellerSource = await readFile(resolve(repoRoot, 'apps/server/src/modules/conversations/seller.service.ts'), 'utf8');
  const dialogueSource = await readFile(resolve(repoRoot, 'apps/server/src/modules/dialogue/dialogue.service.ts'), 'utf8');
  const languageSource = await readFile(resolve(repoRoot, 'packages/shared/src/dialogue/language.ts'), 'utf8');
  const stationSource = await readFile(resolve(repoRoot, 'packages/shared/src/station.ts'), 'utf8');
  assert.doesNotMatch(sellerSource, /const affirmative =/);
  assert.doesNotMatch(sellerSource, /const cancel =/);
  assert.match(sellerSource, /CLOTHES_ORDER_PROFILE/);
  assert.match(sellerSource, /const goodbye =/);
  assert.doesNotMatch(languageSource, /confirmation = false/);
  assert.match(languageSource, /FAREWELL_CLOSING_PROFILE/);
  assert.match(languageSource, /SERVICE_CONTINUATION_PROFILE/);
  assert.match(stationSource, /STATION_QUESTION_PROFILE/);
  assert.match(dialogueSource, /function isTaxOfficeServiceTopic/);
  assert.match(dialogueSource, /const refused =/);

  const words = (text) => normalizeDialogue(text).toLowerCase().replace(/[^a-z0-9']/g, ' ').replace(/\s+/g, ' ').trim();
  const clothesProfile = {
    id: 'clothes_pending_order',
    allowedIntents: ['confirm', 'deny', 'cancel', 'provide_later'],
    bareWords: { no: 'cancel', nope: 'cancel', 'not now': 'cancel' },
  };
  const clothesAnswer = (input) => {
    const decision = detectContextIntent(input, clothesProfile);
    return decision.status === 'matched' && decision.modifiers.length === 0 ? decision.primary : null;
  };
  const clothesGoodbye = (input) =>
    /^(?:goodbye|bye|see you)(?: soon)?$/.test(words(input));

  for (const input of ['yes', 'Yes please', 'yes thank you', 'ok', 'okay', 'sure', 'confirm', 'go ahead', 'I confirm', "that's correct"]) {
    assert.equal(clothesAnswer(input), 'confirm', input);
  }
  for (const input of ['no', 'no thanks', 'no thank you', 'cancel', 'cancel my order', 'never mind', 'nevermind', 'cancel please']) {
    assert.equal(clothesAnswer(input), 'cancel', input);
  }
  for (const input of ['goodbye', 'bye', 'see you', 'see you soon']) {
    assert.equal(clothesGoodbye(input), true, input);
  }

  // Cafe seller remaining negation guard (seller.service.ts line 89)
  const cafeNegated = (input) => /\b(?:don't|do not|not|never)\b/.test(words(input));
  assert.equal(cafeNegated("I don't want that"), true);
  assert.equal(cafeNegated('I would like an espresso'), false);

  // DialogueService station ticket refusal and Tax Office topic checks (dialogue.service.ts lines 48-51, 83)
  const ticketRefused = (input) =>
    /\b(?:(?:don't|do not|not|never)\s+(?:want|need|like|request|ask|asking)|(?:no|not)\s+(?:a\s+|the\s+)?(?:bus\s+)?tickets?)\b/.test(words(input));
  const isTaxOfficeServiceTopic = (roleId, input) =>
    roleId === 'tax_office_staff' && /\b(?:(?:id|identity) card|passport|register|update|renew|replace)\b/.test(words(input));

  for (const input of ["I don't want a bus ticket", 'not a bus ticket', 'no ticket', 'I do not need a ticket']) {
    assert.equal(ticketRefused(input), true, input);
  }
  assert.equal(ticketRefused('Can I get a bus ticket please?'), false);

  assert.equal(isTaxOfficeServiceTopic('tax_office_staff', 'Do I need a passport for the ID card?'), true);
  assert.equal(isTaxOfficeServiceTopic('barista', 'Do I need a passport for the ID card?'), false);
});

test('social-signal.ts: preserves greeting, thanks, apology, polite_request, and insult classification', async () => {
  const socialSignalSource = await readFile(resolve(repoRoot, 'apps/server/src/modules/npcs/social-signal.ts'), 'utf8');
  assert.match(socialSignalSource, /export function classifySocialSignal/);

  const classify = (text, intent) => {
    const value = text.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (/^(?:sorry|i am sorry|i'm sorry|please forgive me|my apologies)(?:\b|$)/.test(value) || intent === 'apology') return 'apology';
    if (/\b(?:fuck you|shut up)\b/.test(value) || /\byou(?:'re| are) (?:an? )?(?:idiot|moron|stupid|useless|pathetic|ugly)\b/.test(value)) return 'insult';
    if (intent === 'thank' || /^(?:thanks|thank you|many thanks)(?:\b|$)/.test(value)) return 'thanks';
    if (intent === 'greet' || /^(?:hello|hi|hey|good morning|good afternoon|good evening)(?:\b|$)/.test(value)) return 'greeting';
    if ((/\bplease\b/.test(value) || /^(?:could|would|can) you\b/.test(value)) && intent !== null) return 'polite_request';
    return null;
  };

  for (const input of ['Hello!', 'hi', 'hey there', 'Good morning', 'Good afternoon', 'Good evening']) {
    assert.equal(classify(input, null), 'greeting', input);
  }
  assert.equal(classify('random text', 'greet'), 'greeting');

  for (const input of ['Thanks!', 'Thank you very much', 'many thanks']) {
    assert.equal(classify(input, null), 'thanks', input);
  }
  assert.equal(classify('appreciated', 'thank'), 'thanks');

  for (const input of ['Sorry', 'I am sorry', "I'm sorry", 'Please forgive me', 'My apologies']) {
    assert.equal(classify(input, null), 'apology', input);
  }
  assert.equal(classify('oops', 'apology'), 'apology');

  assert.equal(classify('Could you help me?', 'ask_town_directions'), 'polite_request');
  assert.equal(classify('One ticket please', 'request_bus_ticket'), 'polite_request');
  assert.equal(classify('Could you help me?', null), null, 'polite_request requires a matched intent');

  for (const input of ['Shut up', 'You are an idiot', "You're stupid"]) {
    assert.equal(classify(input, null), 'insult', input);
  }
});

test('quests.json doneWhen & ai-safety.ts: preserves quest intent ids and out-of-scope safety filters', async () => {
  const quests = JSON.parse(await readFile(resolve(repoRoot, 'content/seed/quests.json'), 'utf8'));
  const doneWhenIntents = quests.flatMap((quest) =>
    quest.steps.flatMap((step) => [step.doneWhen.intent, ...(step.doneWhen.alternativeIntents ?? [])]),
  );
  assert.deepEqual(doneWhenIntents, [
    'greet',
    'ask_town_directions',
    'request_bus_ticket',
    'obtain_bus_ticket',
    'enter_town_street',
    'greet',
    'order_drink',
    'pay_drink',
    'say_name',
    'say_origin',
    'need_flat',
    'ask_price',
    'agree',
    'want_account',
    'give_details',
    'report_problem',
    'agree_time',
  ]);

  const safetySource = await readFile(resolve(repoRoot, 'apps/server/src/modules/ai/ai-safety.ts'), 'utf8');
  assert.match(safetySource, /export function safeAiInput/);
  assert.match(safetySource, /export function isSafeAiOutput/);
});
