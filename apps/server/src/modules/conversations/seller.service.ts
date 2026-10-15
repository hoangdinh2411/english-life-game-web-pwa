import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable } from '@nestjs/common';
import { normalizeDialogue, type PendingOrder, type SellerState, type ShopItem } from '@life-abroad/shared';
import { PoolClient } from 'pg';
import { DialogueService, type DialogueContext } from '../dialogue/dialogue.service';
import { LifeService } from '../life/life.service';
import { ConversationsRepository, sellerState, type ConversationRow } from './conversations.repository';

interface SellerReply { text: string; intent: string; misunderstood: boolean; seller: SellerState; nodeId?: string; drinkPaid?: boolean; drinkOrdered?: boolean; greeted?: boolean }

function words(text: string): string {
  return normalizeDialogue(text).toLowerCase().replace(/[^a-z0-9']/g, ' ').replace(/\s+/g, ' ').trim();
}

function contains(text: string, phrase: string): boolean {
  return ` ${text} `.includes(` ${words(phrase)} `);
}

function namedItems(text: string, items: ShopItem[]): ShopItem[] {
  return items.filter(item => {
    const name = words(item.name);
    return contains(text, name) || contains(text, `${name}s`);
  });
}

function quantity(text: string): number | undefined {
  const numberWords = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
  const tokens = text.split(' ');
  const amounts = tokens.flatMap(token => /^\d+$/.test(token) ? [Number(token)] :
    numberWords.includes(token) ? [numberWords.indexOf(token)] : []);
  if (!amounts.length) return undefined;
  return amounts.length === 1 && !/\b(?:minus|negative|half|dozen)\b/.test(text) ? amounts[0] : 0;
}

@Injectable()
export class SellerService {
  constructor(private readonly dialogue: DialogueService, private readonly life: LifeService,
    private readonly conversations: ConversationsRepository) {}

  async opening(context: DialogueContext): Promise<string> {
    return (await this.dialogue.node(context,
      context.npcId === 'npc_clothes_seller' ? 'clothes_seller_start' : 'seller_start')).text;
  }

  async reply(client: PoolClient, userId: string, row: ConversationRow,
    context: DialogueContext, input: string): Promise<SellerReply> {
    if (context.npcId === 'npc_clothes_seller') return this.clothesReply(client, userId, row, context, input);
    const state = sellerState(row);
    if (state.closed) throw new ConflictException('This conversation has ended. Start a new conversation');
    const text = words(input);
    const catalog = await client.query<ShopItem>(
      "SELECT id,name,kind,price,shop FROM public.shop_items WHERE shop='cafe' ORDER BY id FOR SHARE");
    const items = catalog.rows;
    const matches = namedItems(text, items);
    const start = await this.dialogue.node(context, 'seller_start');
    // Authored keywords route dialogue; confirmation additionally requires a
    // complete affirmative phrase so "yes, but change it" cannot spend money.
    const route = start.node.intents?.find(intent => intent.keywords.some(keyword => contains(text, keyword)))?.name;
    const greeted = start.node.intents?.find(intent => intent.name === 'greet')?.keywords.some(keyword => contains(text, keyword)) ?? false;
    if (!route && !matches.length && !/\b(?:want|order|buy|change|make|instead|would like|can i have)\b/.test(text)) {
      const common = await this.dialogue.reply(context, input, true);
      if (common.intent) return { text: common.text, intent: common.intent, misunderstood: false, seller: state };
    }
    let intent: string;
    let order: PendingOrder | null = state.pendingOrder;
    let closed = false;
    let drinkPaid = false;
    let drinkOrdered = false;
    const values: Record<string, string> = {};
    if (route === 'directions') intent = 'directions';
    else if (route === 'goodbye') { intent = 'goodbye'; order = null; closed = true; }
    else if (route === 'cancel' || /^(?:no|no thanks|no thank you|not now)(?: please)?$/.test(text)) {
      intent = 'cancel'; order = null;
    } else if (route === 'ask_menu') {
      intent = 'ask_menu'; values.menu = items.map(item => `${item.name}: $${item.price}`).join('; ');
    } else if (route === 'ask_price') {
      intent = matches.length === 1 ? 'ask_price' : 'ask_menu';
      if (matches.length === 1) { values.item = matches[0]!.name; values.price = String(matches[0]!.price); }
      else values.menu = items.map(item => `${item.name}: $${item.price}`).join('; ');
    } else if (/\b(?:don't|do not|not|never)\b/.test(text)) intent = 'clarify';
    else if (/^(?:yes|yes please|yes thank you|ok|okay|sure|confirm|confirm my order|please confirm|that is correct|that's correct|go ahead|i confirm)$/.test(text)) {
      intent = 'no_order';
      if (!order && ['seller_start', 'seller_greet'].includes(row.current_node_id ?? '')) {
        intent = 'ask_menu'; values.menu = items.map(item => `${item.name}: $${item.price}`).join('; ');
      } else if (order) {
        const item = items.find(candidate => candidate.id === order!.itemId);
        if (!item || item.price !== order.unitPrice) {
          intent = 'price_changed'; order = null;
        } else {
          values.order = `${order.quantity} × ${item.name}`; values.total = String(order.total);
          if (!['seller_order', 'seller_insufficient_funds'].includes(row.current_node_id ?? '')) {
            // A "yes" to a price/menu question must first repeat the actual
            // pending order, rather than silently paying for a different item.
            intent = 'order';
            drinkOrdered = item.kind === 'drink';
          } else if (await this.life.fulfillCafeOrder(client, userId, item, order.quantity, order.orderId)) {
            intent = 'paid'; drinkPaid = item.kind === 'drink'; order = null;
          } else intent = 'insufficient_funds';
        }
      }
    } else if (matches.length || /\b(?:want|like|order|buy|have|change|make|instead)\b/.test(text)) {
      const count = quantity(text);
      const item = matches.length === 1 ? matches[0] :
        !matches.length && /\b(?:change|make)\b/.test(text) && order ? items.find(candidate => candidate.id === order!.itemId) : undefined;
      if (matches.length > 1 || /\b(?:and|or|plus)\b/.test(text) || /[+&]/.test(input)) intent = 'one_item';
      else if (count !== undefined && (count < 1 || count > 3) || /\b(?:half|dozen|negative|minus)\b/.test(text) || /-\s*\d/.test(input)) intent = 'invalid_quantity';
      else if (!item) intent = 'unknown_item';
      else {
        const amount = count ?? 1;
        order = { orderId: randomUUID(), itemId: item.id, quantity: amount, unitPrice: item.price, total: item.price * amount };
        drinkOrdered = item.kind === 'drink';
        intent = 'order'; values.order = `${amount} × ${item.name}`; values.total = String(order.total);
      }
    } else intent = route === 'greet' ? 'greet' : 'clarify';
    const reply = await this.dialogue.node(context, `seller_${intent}`);
    await this.conversations.saveOrder(client, row.id, order, closed);
    return { text: reply.text.replace(/\{(\w+)\}/g, (token, key: string) => values[key] ?? token), intent,
      misunderstood: ['clarify', 'unknown_item', 'invalid_quantity', 'one_item'].includes(intent),
      seller: { shop: 'cafe', pendingOrder: order, closed }, drinkPaid, drinkOrdered, greeted };
  }

  private async clothesReply(client: PoolClient, userId: string, row: ConversationRow,
    context: DialogueContext, input: string): Promise<SellerReply> {
    const state = sellerState(row);
    if (state.closed) throw new ConflictException('This conversation has ended. Start a new conversation');
    const text = words(input);
    const catalog = await client.query<ShopItem>(
      "SELECT id,name,kind,price,shop,color FROM public.shop_items WHERE shop='clothes' AND kind='clothing' ORDER BY id FOR SHARE");
    const items = catalog.rows;
    const matches = namedItems(text, items);
    const affirmative = /^(?:yes|yes please|yes thank you|ok|okay|sure|confirm|go ahead|i confirm|that is correct|that's correct)$/.test(text);
    const cancel = /^(?:no|no thanks|no thank you|cancel|cancel my order|never mind|nevermind)(?: please)?$/.test(text);
    const goodbye = /^(?:goodbye|bye|see you)(?: soon)?$/.test(text);
    let intent = 'clarify';
    let order: PendingOrder | null = state.pendingOrder;
    let closed = false;
    const values: Record<string, string> = { menu: items.map(item => `${item.name} for $${item.price}`).join(', ') };
    let nodeId = 'clothes_seller_clarify';

    if (/\b(?:leave|exit|bus|town|receptionist)\b/.test(text)) { intent = 'directions'; nodeId = 'clothes_seller_directions'; }
    else if (goodbye) { intent = 'goodbye'; order = null; closed = true; nodeId = 'clothes_seller_goodbye'; }
    else if (cancel) { intent = 'cancel'; order = null; nodeId = 'clothes_seller_cancel'; }
    else if (affirmative && order && row.current_node_id === 'clothes_seller_order') {
      const item = items.find(candidate => candidate.id === order!.itemId);
      if (!item || item.price !== order.unitPrice) { intent = 'price_changed'; order = null; nodeId = 'clothes_seller_price_changed'; }
      else if (await this.life.fulfillClothesOrder(client, userId, item, order.orderId)) {
        intent = 'paid'; values.order = item.name; values.total = String(item.price);
        order = null; nodeId = 'clothes_seller_paid';
      } else { intent = 'insufficient_funds'; values.total = String(item.price); nodeId = 'clothes_seller_insufficient_funds'; }
    }
    else if (affirmative && !order) { intent = 'no_order'; nodeId = 'clothes_seller_no_order'; }
    else if (matches.length === 1) {
      const item = matches[0]!;
      if (/\b(?:want|like|order|buy|have|would like)\b/.test(text)) {
        const orderId = randomUUID();
        order = { orderId, itemId: item.id, quantity: 1, unitPrice: item.price, total: item.price };
        intent = 'order'; nodeId = 'clothes_seller_order'; values.order = item.name; values.total = String(item.price);
      } else { intent = 'ask_price'; nodeId = 'clothes_seller_price'; values.item = item.name; values.price = String(item.price); }
    }
    else if (matches.length > 1) { intent = 'ask_menu'; nodeId = 'clothes_seller_items'; }
    else if (/\b(?:menu|shirt|shirts|clothes|what do you have|what can i get|what can i buy|what colors)\b/.test(text)) {
      intent = 'ask_menu'; nodeId = 'clothes_seller_items';
    }
    if (intent === 'clarify') {
      const common = await this.dialogue.reply(context, input, true);
      if (common.intent) return { text: common.text, intent: common.intent, misunderstood: false, seller: state, nodeId: common.node.id };
    }
    const reply = await this.dialogue.node(context, nodeId);
    await this.conversations.saveOrder(client, row.id, order, closed);
    return { text: reply.text.replace(/\{(\w+)\}/g, (token, key: string) => values[key] ?? token), intent,
      misunderstood: intent === 'clarify', nodeId, seller: { shop: 'clothes', pendingOrder: order, closed } };
  }
}
