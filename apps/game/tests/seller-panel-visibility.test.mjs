import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { sellerPanelVisibility } from '../src/features/shops/seller-panel-visibility.ts';

test('the café menu opens only after a direct request or an affirmative menu reply', () => {
  assert.deepEqual(sellerPanelVisibility([
    { sender: 'npc', text: 'Would you like to see our menu?' },
  ]), { menu: false, orders: false });
  assert.equal(sellerPanelVisibility([
    { sender: 'npc', text: 'Would you like to see our menu?' },
    { sender: 'player', text: 'Yes, please.' },
  ]).menu, true);
  assert.equal(sellerPanelVisibility([
    { sender: 'npc', text: 'Welcome.' },
    { sender: 'player', text: 'Can I see the menu?' },
  ]).menu, true);
  assert.equal(sellerPanelVisibility([
    { sender: 'npc', text: 'Welcome.' },
    { sender: 'player', text: "I'd like an espresso, please." },
  ]).menu, false);
});

test('order history opens after a history question without opening the menu', () => {
  assert.deepEqual(sellerPanelVisibility([
    { sender: 'npc', text: 'Would you like to see our menu?' },
    { sender: 'player', text: 'Can I see my past orders?' },
  ]), { menu: false, orders: true });
});

test('every café seller greeting offers the menu before ordering', async () => {
  const path = new URL('../../../content/dialogue/common/role_seller_cafe.json', import.meta.url);
  const content = JSON.parse(await readFile(path, 'utf8'));
  const start = content.nodes.find(node => node.id === 'seller_start');
  assert.ok(start.variations.length > 0);
  assert.ok(start.variations.every(text => /would you like.{0,32}(?:see|look at).{0,12}menu/i.test(text)));
});

test('the menu reply points to the visual menu without repeating its items', async () => {
  const path = new URL('../../../content/dialogue/common/role_seller_cafe.json', import.meta.url);
  const content = JSON.parse(await readFile(path, 'utf8'));
  const menuReply = content.nodes.find(node => node.id === 'seller_ask_menu');
  assert.match(menuReply.text.default, /menu below/i);
  assert.doesNotMatch(menuReply.text.default, /\{menu\}/i);
});

test('the café catalog contains both drinks and food for category cards', async () => {
  const path = new URL('../../../content/seed/shops.json', import.meta.url);
  const items = JSON.parse(await readFile(path, 'utf8'));
  const cafeItems = items.filter(item => item.shop === 'cafe');
  assert.equal(cafeItems.filter(item => item.kind === 'drink').length, 5);
  assert.equal(cafeItems.filter(item => item.kind === 'food').length, 5);
});
