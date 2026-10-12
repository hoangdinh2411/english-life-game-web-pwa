import type { ArrivalState, Conversation, ConversationTurn, SendMessageRequest } from '@life-abroad/shared';

export interface ConversationApi {
  load: () => Promise<ArrivalState>;
  start: () => Promise<Conversation>;
  send: (id: string, body: SendMessageRequest) => Promise<ConversationTurn>;
  read?: (id: string) => Promise<Conversation>;
  enter?: () => Promise<ArrivalState>;
}
export interface ConversationSnapshot {
  arrival: ArrivalState | null;
  conversation: Conversation | null;
  pending: boolean;
  error: string;
  correction: ConversationTurn['correction'];
  retryMessage: SendMessageRequest | null;
}

// Private state lives only in memory. All mutations come from authenticated API responses.
export function createConversationController(api: ConversationApi) {
  let state: ConversationSnapshot = { arrival: null, conversation: null, pending: false, error: '', correction: null, retryMessage: null };
  let epoch = 0;
  let disposed = false;
  let retry: SendMessageRequest | null = null;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<ConversationSnapshot>) => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  };
  const run = async (operation: () => Promise<Partial<ConversationSnapshot>>): Promise<boolean> => {
    if (disposed || state.pending) return false;
    const current = epoch;
    update({ pending: true, error: '' });
    try {
      const patch = await operation();
      if (disposed || current !== epoch) return false;
      update(patch);
      return true;
    } catch (failure) {
      if (!disposed && current === epoch) update({ error: failure instanceof TypeError || (failure instanceof Error && failure.name === 'TimeoutError')
        ? 'Could not confirm the server response. Check your connection, then retry.'
        : failure instanceof Error ? failure.message : 'Check your connection, then retry.' });
      return false;
    } finally {
      if (!disposed && current === epoch) update({ pending: false });
    }
  };
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    load: () => {
      disposed = false;
      return run(async () => ({ arrival: await api.load() }));
    },
    start: () => state.conversation ? Promise.resolve(true) : run(async () => {
      const conversation = await api.start();
      return { conversation, arrival: conversation.arrival };
    }),
    send: (input: string, coach = false) => {
      const text = input.trim();
      const conversation = state.conversation;
      if (!conversation || !text || state.pending || disposed) return Promise.resolve(false);
      if (retry && (retry.text !== text || retry.coach !== coach)) {
        update({ error: 'Retry your previous reply before sending a different message.' });
        return Promise.resolve(false);
      }
      const body = retry ?? { text, coach, clientMessageId: crypto.randomUUID() };
      retry = body;
      update({ retryMessage: body });
      return run(async () => {
        let turn: ConversationTurn;
        try { turn = await api.send(conversation.id, body); }
        catch (failure) {
          // Validation/ordering failures commit nothing; let the learner change their reply.
          const status = typeof failure === 'object' && failure !== null && 'status' in failure ? failure.status : null;
          if (typeof status === 'number' && status >= 400 && status < 500 && status !== 401 && status !== 429) { retry = null; update({ retryMessage: null }); }
          throw failure;
        }
        // The API may replay an old snapshot; refresh persisted eligibility before exiting.
        const latest = api.read ? await api.read(conversation.id) : null;
        const arrival = latest?.arrival ?? await api.load();
        retry = null;
        const messages = [...conversation.messages];
        for (const message of [turn.playerMessage, turn.npcMessage]) if (!messages.some((item) => item.id === message.id)) messages.push(message);
        const seller = latest?.seller ?? turn.seller;
        const coffeeQuest = latest?.coffeeQuest ?? turn.coffeeQuest;
        return { conversation: { ...conversation, messages, arrival, ...(seller ? { seller } : {}),
          ...(coffeeQuest ? { coffeeQuest } : {}) }, arrival, correction: turn.correction ?? null, retryMessage: null };
      });
    },
    enter: () => {
      const enter = api.enter;
      if (!enter || !state.arrival?.canEnterTownStreet) return Promise.resolve(false);
      return run(async () => {
        const arrival = await enter();
        if (arrival.locationId !== 'loc_town_street' || !arrival.ticket.used || !arrival.rewardsGranted) throw new Error('Town Street access could not be confirmed. Try again.');
        return { arrival };
      });
    },
    dispose: () => { disposed = true; epoch++; state = { ...state, pending: false }; listeners.clear(); },
  };
}
