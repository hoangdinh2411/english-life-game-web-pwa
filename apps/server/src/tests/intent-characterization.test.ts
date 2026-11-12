import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { resolve } from 'node:path';
import type { PendingOrder, ShopItem } from '@life-abroad/shared';
import type { PoolClient } from 'pg';
import type { CachedDialogueNode, DialogueCacheService } from '../infrastructure/content/dialogue-cache.service';
import { loadSeedContent } from '../infrastructure/content/seed-content';
import { DialogueService } from '../modules/dialogue/dialogue.service';
import type { ConversationRow, ConversationsRepository } from '../modules/conversations/conversations.repository';
import { IdCardApplicationContentService } from '../modules/conversations/id-card-application-content.service';
import { IdCardApplicationService, type IdCardApplicationRow } from '../modules/conversations/id-card-application.service';
import { SellerService } from '../modules/conversations/seller.service';
import type { LifeService } from '../modules/life/life.service';

// T40.a characterization: records the current state transitions of the legacy
// matchers (ID-card application and cafe seller) so T40.c/T41 change them on purpose.

const arrival = {
  questId: 'q_station_arrival', status: 'done', currentStepId: null, ticket: { issued: true, used: true },
  canEnterTownStreet: true, rewardsGranted: true, locationId: 'loc_tax_office',
} as const;

function idCardFixture(initial: Partial<IdCardApplicationRow> & Pick<IdCardApplicationRow, 'current_field'>) {
  const state: { row: IdCardApplicationRow | null; deleted: number } = { deleted: 0, row: {
    name: 'Test Learner', date_of_birth: '1995-02-28', address: '12 Maple Street', gender: 'female', origin: 'Vietnam', ...initial,
  } };
  const client = { query: async (sql: string, values: readonly unknown[] = []) => {
    if (sql.includes('SELECT current_field')) return { rows: state.row ? [{ ...state.row }] : [] };
    if (sql.includes('SELECT 1 FROM public.player_id_card')) return { rows: [] };
    if (sql.includes('DELETE FROM public.id_card_applications')) { state.row = null; state.deleted += 1; return { rows: [], rowCount: 1 }; }
    if (sql.includes('SET address=NULL')) { state.row!.address = null; return { rows: [], rowCount: 1 }; }
    if (sql.includes('UPDATE public.id_card_applications SET current_field')) {
      state.row!.current_field = String(values[1]) as IdCardApplicationRow['current_field'];
      if (sql.includes(',name=')) state.row!.name = values[2] as string;
      if (sql.includes(',date_of_birth=')) state.row!.date_of_birth = values[2] as string;
      if (sql.includes(',address=')) state.row!.address = values[2] as string | null;
      if (sql.includes(',origin=')) state.row!.origin = values[2] as string;
      return { rows: [], rowCount: 1 };
    }
    throw new Error(`Unexpected query: ${sql}`);
  } } as unknown as PoolClient;
  const service = new IdCardApplicationService(new IdCardApplicationContentService());
  return { state, say: (input: string) => service.reply(client, 'player-id', input, arrival) };
}

test('ID-card address question: unavailable answers store null and advance to origin', async () => {
  for (const input of [
    "I don't have any address right now", "Sorry, I don't have any address right now",
    "I don't have one, but I'll provide it later", 'I do not have an address yet', "I'll update it later",
    'I am staying at a hotel', 'I have no permanent address',
  ]) {
    const { state, say } = idCardFixture({ current_field: 'address', origin: null, address: null });
    const reply = await say(input);
    assert.equal(state.row?.address, null, input);
    assert.equal(state.row?.current_field, 'origin', input);
    assert.match(reply!.responseText, /provide an address later/i, input);
  }
});

test('ID-card address question: a real address is stored; skip asks again and changes nothing', async () => {
  const stored = idCardFixture({ current_field: 'address', origin: null, address: null });
  await stored.say('12 Maple Street');
  assert.deepEqual([stored.state.row?.address, stored.state.row?.current_field], ['12 Maple Street', 'origin']);

  const skipped = idCardFixture({ current_field: 'address', origin: null, address: null });
  const retry = await skipped.say('skip');
  assert.deepEqual([skipped.state.row?.address, skipped.state.row?.current_field], [null, 'address']);
  assert.match(retry!.responseText, /Sorry, what’s your address/);
});

test('ID-card address question: current gaps — unlisted wordings are stored as the address text', async () => {
  // These literals are saved today; T40.b/c replace this with intent detection.
  for (const input of ['I no have address', "I don't know", 'nothing']) {
    const { state, say } = idCardFixture({ current_field: 'address', origin: null, address: null });
    await say(input);
    assert.equal(state.row?.address, input);
    assert.equal(state.row?.current_field, 'origin');
  }
});

test('ID-card cancellation: only the exact application phrases cancel; bare "cancel" is a field answer', async () => {
  for (const input of ['cancel my application', 'Stop the application', 'Cancel the application.']) {
    const { state, say } = idCardFixture({ current_field: 'dateOfBirth' });
    const reply = await say(input);
    assert.equal(state.row, null, input);
    assert.equal(reply?.metadata.intent, 'cancel_id_card_application');
  }
  const bare = idCardFixture({ current_field: 'name', origin: null });
  await bare.say('cancel');
  assert.deepEqual([bare.state.row?.name, bare.state.row?.current_field], ['cancel', 'dateOfBirth']);
});

test('ID-card review: yes-like answers submit, no-like answers open corrections, other answers re-ask', async () => {
  for (const input of ['yes', 'Yes, please', 'yes issue my card', 'correct', 'That is correct']) {
    const { state, say } = idCardFixture({ current_field: 'review' });
    const reply = await say(input);
    assert.equal(reply?.metadata.idCardSubmit, true, input);
    assert.equal(state.row?.current_field, 'review', input);
  }
  for (const input of ['no', 'Nope', 'not correct', 'That is wrong']) {
    const { state, say } = idCardFixture({ current_field: 'review' });
    const reply = await say(input);
    assert.equal(reply?.metadata.intent, 'correct_id_card_application', input);
    assert.equal(state.row?.current_field, 'correction', input);
  }
  for (const input of ['Sure', 'ok', 'Exactly', 'maybe', 'yes, but change it']) {
    const { state, say } = idCardFixture({ current_field: 'review' });
    const reply = await say(input);
    assert.equal(reply?.metadata.idCardSubmit, undefined, input);
    assert.equal(state.row?.current_field, 'review', input);
    assert.equal(reply?.metadata.intent, 'review_id_card_application', input);
  }
  const named = idCardFixture({ current_field: 'review' });
  await named.say('yes, change my name');
  assert.equal(named.state.row?.current_field, 'name');
});

test('ID-card review: replaying a confirmation is idempotent and leaves the application unchanged', async () => {
  const { state, say } = idCardFixture({ current_field: 'review' });
  const first = await say('yes');
  const second = await say('yes');
  assert.equal(first?.metadata.idCardSubmit, true);
  assert.deepEqual(second?.metadata, first?.metadata);
  assert.equal(second?.responseText, first?.responseText);
  assert.deepEqual([state.row?.current_field, state.row?.address, state.deleted], ['review', '12 Maple Street', 0]);
});

const espresso: ShopItem = { id: 'item_espresso', name: 'Espresso', kind: 'drink', price: 3, shop: 'cafe' };
const sandwich: ShopItem = { id: 'item_sandwich', name: 'Sandwich', kind: 'food', price: 5, shop: 'cafe' };
const shirt = { id: 'item_shirt', name: 'Shirt', kind: 'clothing', price: 20, shop: 'clothes', color: 'blue' } as unknown as ShopItem;
const context = { npcId: 'npc_mia', roleId: 'barista', personality: 'cheerful', store: true };
const clothesContext = { npcId: 'npc_clothes_seller', roleId: 'shop_clothes', personality: 'cheerful', store: true };

async function cafeFixture() {
  const content = await loadSeedContent(resolve('../../content'));
  const nodes: CachedDialogueNode[] = content.dialogues.flatMap(file => file.nodes.map(node => ({
    node, scope: file.scope, version: file.version,
    roleId: file.scope === 'role' ? file.role : null, npcId: file.scope === 'npc' ? file.npcId : null,
  })));
  const dialogue = new DialogueService({ getNodes: async () => nodes } as unknown as DialogueCacheService);
  const catalog = [espresso, sandwich];
  const calls = { fulfilled: [] as string[], saved: [] as { order: PendingOrder | null; closed: boolean }[] };
  let affordable = true;
  const life = { fulfillCafeOrder: async (_client: PoolClient, _user: string, _item: ShopItem, _quantity: number, orderId: string) => {
    calls.fulfilled.push(orderId);
    return affordable;
  }, fulfillClothesOrder: async (_client: PoolClient, _user: string, _item: ShopItem, orderId: string) => {
    calls.fulfilled.push(orderId);
    return affordable;
  } } as unknown as LifeService;
  const conversations = { saveOrder: async (_client: PoolClient, _id: string, order: PendingOrder | null, closed: boolean) => {
    calls.saved.push({ order, closed });
  } } as unknown as ConversationsRepository;
  const service = new SellerService(dialogue, life, conversations);
  const client = { query: async (sql: string) => ({ rows: sql.includes("shop='clothes'") ? [shirt] : catalog }) } as unknown as PoolClient;
  const pending = (item = espresso, unitPrice = item.price): PendingOrder =>
    ({ orderId: randomUUID(), itemId: item.id, quantity: 1, unitPrice, total: unitPrice });
  const row = (order: PendingOrder | null, node: string, npcId = 'npc_mia'): ConversationRow => ({
    id: 'conversation-id', npc_id: npcId, current_node_id: node, opening_variation_index: 0, pending_order: order, ended_at: null });
  const say = (input: string, order: PendingOrder | null, node = 'seller_order') =>
    service.reply(client, 'player-id', row(order, node), context, input);
  const sayClothes = (input: string, order: PendingOrder | null, node = 'clothes_seller_order') =>
    service.reply(client, 'player-id', row(order, node, 'npc_clothes_seller'), clothesContext, input);
  return { say, sayClothes, pending, shirt, calls, setAffordable: (value: boolean) => { affordable = value; } };
}

test('cafe confirm: complete affirmative phrases pay the pending order once', async () => {
  const { say, pending, calls } = await cafeFixture();
  for (const input of ['yes', 'Yes, please', 'ok', 'sure', 'confirm', 'please confirm',
    "that's correct", 'go ahead', 'I confirm']) {
    const order = pending();
    const reply = await say(input, order);
    assert.equal(reply.intent, 'paid', input);
    assert.equal(reply.drinkPaid, true, input);
    assert.equal(reply.seller.pendingOrder, null, input);
    assert.equal(calls.fulfilled.at(-1), order.orderId, input);
  }
});

test('cafe confirm: replaying a confirmation reuses the same order id as the idempotency key', async () => {
  const { say, pending, calls } = await cafeFixture();
  const order = pending();
  await say('yes', order);
  await say('yes', order);
  assert.deepEqual(calls.fulfilled, [order.orderId, order.orderId]);
});

test('cafe confirm: yes outside the order question repeats the order and never pays', async () => {
  const { say, pending, calls } = await cafeFixture();
  const order = pending();
  const reply = await say('yes', order, 'seller_ask_price');
  assert.equal(reply.intent, 'order');
  assert.equal(reply.seller.pendingOrder?.orderId, order.orderId);
  assert.deepEqual(calls.fulfilled, []);
  assert.equal((await say('yes', null, 'seller_clarify')).intent, 'no_order');
  assert.equal((await say('yes', null, 'seller_start')).intent, 'ask_menu');
});

test('cafe confirm: affirmatives mixed with extra words, negation or a change never pay', async () => {
  const { say, pending, calls } = await cafeFixture();
  const order = pending();
  const changed = await say('yes, but change it', order);
  assert.equal(changed.intent, 'order');
  assert.notEqual(changed.seller.pendingOrder?.orderId, order.orderId);
  const refused = await say('I do not want it', order);
  assert.equal(refused.intent, 'clarify');
  assert.equal(refused.seller.pendingOrder?.orderId, order.orderId);
  assert.deepEqual(calls.fulfilled, []);
});

test('cafe confirm: insufficient funds keep the order; a changed price clears it', async () => {
  const { say, pending, calls, setAffordable } = await cafeFixture();
  setAffordable(false);
  const order = pending();
  const poor = await say('yes', order);
  assert.equal(poor.intent, 'insufficient_funds');
  assert.equal(poor.seller.pendingOrder?.orderId, order.orderId);
  assert.equal(calls.fulfilled.length, 1);
  const stale = await say('yes', pending(espresso, 2));
  assert.equal(stale.intent, 'price_changed');
  assert.equal(stale.seller.pendingOrder, null);
  assert.equal(calls.fulfilled.length, 1);
});

test('cafe cancel: no-like and cancel phrases clear the pending order without charging', async () => {
  const { say, pending, calls } = await cafeFixture();
  for (const input of ['no', 'not now', 'no please', 'cancel', 'cancel my order', 'never mind', 'nevermind']) {
    const reply = await say(input, pending());
    assert.equal(reply.intent, 'cancel', input);
    assert.equal(reply.seller.pendingOrder, null, input);
    assert.equal(reply.seller.closed, false, input);
  }
  assert.deepEqual(calls.fulfilled, []);
});

test('cafe current gap: answers that hit a global reply first change nothing', async () => {
  // The seller regexes list "yes thank you", "no thanks" and "okay", but a shared
  // global intent (thank, feeling_fine) answers first, so none confirm or cancel today.
  const { say, pending, calls } = await cafeFixture();
  for (const [input, intent] of [['yes thank you', 'thank'], ['No thanks', 'thank'], ['no thank you', 'thank'],
    ['Okay', 'feeling_fine']] as const) {
    const order = pending();
    const reply = await say(input, order);
    assert.equal(reply.intent, intent, input);
    assert.equal(reply.seller.pendingOrder?.orderId, order.orderId, input);
  }
  assert.deepEqual(calls.fulfilled, []);
  assert.deepEqual(calls.saved, []);
});

test('clothes seller (migrated by T41): confirm pays, cancel clears, goodbye closes, thanks-answers are unclear', async () => {
  const { sayClothes, pending, shirt, calls } = await cafeFixture();
  for (const input of ['yes', 'Yes please', 'yes thank you', 'ok', 'sure', 'confirm', 'go ahead', 'I confirm', "that's correct"]) {
    const order = pending(shirt);
    const reply = await sayClothes(input, order);
    assert.equal(reply.intent, 'paid', input);
    assert.equal(reply.seller.pendingOrder, null, input);
    assert.equal(calls.fulfilled.at(-1), order.orderId, input);
  }
  assert.equal((await sayClothes('yes', null)).intent, 'no_order');
  assert.equal((await sayClothes('yes', pending(shirt), 'clothes_seller_price')).intent, 'clarify');
  for (const input of ['no', 'No thanks', 'cancel', 'cancel my order', 'never mind']) {
    const reply = await sayClothes(input, pending(shirt));
    assert.equal(reply.intent, 'cancel', input);
    assert.equal(reply.seller.pendingOrder, null, input);
  }
  for (const input of ['goodbye', 'bye', 'See you soon']) {
    const reply = await sayClothes(input, pending(shirt));
    assert.equal(reply.intent, 'goodbye', input);
    assert.equal(reply.seller.closed, true, input);
  }
});
