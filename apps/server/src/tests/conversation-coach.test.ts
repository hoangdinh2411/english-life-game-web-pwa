import assert from 'node:assert/strict';
import test from 'node:test';
import { ConversationReplyEnrichmentService } from '../modules/conversations/conversation-reply-enrichment.service';

test('backend recasts service English by default but never rewrites ID-card identity answers', async () => {
  const service = new ConversationReplyEnrichmentService(
    {} as never,
    {} as never,
    { enabled: false } as never,
    {} as never,
    {} as never,
    { context: async () => ({ familiarity: 0, affinity: 0, stage: 'stranger', reactionMood: null, reactionExpiresAt: null }) } as never,
    { resolve: async () => ({ id: 'neutral' }) } as never,
  );
  const base = {
    client: {} as never,
    userId: 'user-id',
    conversationId: 'conversation-id',
    conversation: { npc_id: 'npc_tax_clerk_marcus', pending_order: null } as never,
    context: {} as never,
    history: [],
  };
  const request = { text: 'I need ID card', clientMessageId: 'message-id' };
  const arrival = { locationId: 'loc_tax_office' } as never;

  const recast = await service.enrich({ ...base, request,
    scripted: { arrival, nodeId: 'application_name', responseText: 'What is your full name?',
      metadata: { arrival, intent: 'register_id_card', misunderstood: false } } });
  assert.equal(recast.responseText, 'Oh, you need an ID card? What is your full name?');

  const identityAnswer = await service.enrich({ ...base, request,
    scripted: { arrival, nodeId: 'application_origin', responseText: 'Where do you come from?',
      metadata: { arrival, intent: 'save_id_card_address', misunderstood: false } } });
  assert.equal(identityAnswer.responseText, 'Where do you come from?');

  const alwaysEnabled = await service.enrich({ ...base, request,
    scripted: { arrival, nodeId: 'application_name', responseText: 'What is your full name?',
      metadata: { arrival, intent: 'register_id_card', misunderstood: false } } });
  assert.equal(alwaysEnabled.responseText, 'Oh, you need an ID card? What is your full name?');
});
