type SellerMessage = { sender: 'player' | 'npc'; text: string };

const directMenuRequest = /\b(menu|what do you have|what can i (?:get|order)|show me (?:what you have|options))\b/i;
const affirmativeReply = /^(?:yes|yeah|sure|okay|ok|please|that sounds good)\b/i;
const orderHistoryRequest = /\b(?:past|previous|recent|last|earlier|history)\b.{0,32}\b(?:orders?|purchases?)\b|\b(?:show|see|list)\b.{0,32}\b(?:my )?(?:orders?|purchases?)\b/i;

export function sellerPanelVisibility(messages: readonly SellerMessage[]): { menu: boolean; orders: boolean } {
  let menu = false;
  let orders = false;

  for (let index = 0; index < messages.length; index++) {
    const message = messages[index];
    if (!message || message.sender !== 'player') continue;
    if (directMenuRequest.test(message.text)) menu = true;
    if (orderHistoryRequest.test(message.text)) orders = true;

    if (affirmativeReply.test(message.text.trim())) {
      const previousNpc = messages.slice(0, index).findLast(candidate => candidate.sender === 'npc');
      if (previousNpc && /\bmenu\b/i.test(previousNpc.text)) menu = true;
    }
  }

  return { menu, orders };
}
