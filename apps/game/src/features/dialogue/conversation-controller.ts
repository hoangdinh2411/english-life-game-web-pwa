import type { ArrivalState, Conversation, ConversationTurn, SendMessageRequest } from '@life-abroad/shared';

export interface ConversationApi {
  load: () => Promise<ArrivalState>;
  start: () => Promise<Conversation>;
  send: (id: string, body: SendMessageRequest) => Promise<ConversationTurn>;
  stream?: (id: string, npcId: Conversation['npcId'], body: SendMessageRequest,
    onToken: (text: string) => void, signal: AbortSignal) => Promise<ConversationTurn>;
  enter?: () => Promise<ArrivalState>;
}
export interface ConversationSnapshot {
  arrival: ArrivalState | null;
  conversation: Conversation | null;
  pending: boolean;
  error: string;
  correction: ConversationTurn['correction'];
  retryMessage: SendMessageRequest | null;
  streaming: boolean;
  streamedReply: string;
  announcement: string;
}

const typingPause = (milliseconds: number): Promise<void> =>
  new Promise(resolve => globalThis.setTimeout(resolve, milliseconds));

export async function revealStreamChunk(text: string, emit: (piece: string) => void,
  signal?: AbortSignal, pause: (milliseconds: number) => Promise<void> = typingPause): Promise<void> {
  const pieces = Array.from(text);
  for (const [index, piece] of pieces.entries()) {
    if (signal?.aborted) throw signal.reason ?? new Error('Chat stream cancelled.');
    emit(piece);
    if (index < pieces.length - 1) await pause(28);
  }
}

// Private state lives only in memory. All mutations come from authenticated API responses.
export function createConversationController(api: ConversationApi) {
  let state: ConversationSnapshot = { arrival: null, conversation: null, pending: false, error: '', correction: null, retryMessage: null,
    streaming: false, streamedReply: '', announcement: '' };
  let epoch = 0;
  let disposed = false;
  let retry: SendMessageRequest | null = null;
  let streamCancellation: AbortController | null = null;
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
        try {
          if (api.stream) {
            streamCancellation = new AbortController();
            update({ streaming: true, streamedReply: '', announcement: '' });
            let revealQueue = Promise.resolve();
            turn = await api.stream(conversation.id, conversation.npcId, body,
              chunk => { revealQueue = revealQueue.then(() => revealStreamChunk(chunk,
                piece => update({ streamedReply: state.streamedReply + piece }), streamCancellation?.signal)); },
              streamCancellation.signal);
            await revealQueue;
          } else turn = await api.send(conversation.id, body);
        }
        catch (failure) {
          // Validation/ordering failures commit nothing; let the learner change their reply.
          const status = typeof failure === 'object' && failure !== null && 'status' in failure ? failure.status : null;
          if (typeof status === 'number' && status >= 400 && status < 500 && status !== 401 && status !== 429) { retry = null; update({ retryMessage: null }); }
          throw failure;
        }
        const arrival = turn.arrival;
        retry = null;
        const messages = [...conversation.messages];
        for (const message of [turn.playerMessage, turn.npcMessage]) if (!messages.some((item) => item.id === message.id)) messages.push(message);
        const seller = turn.seller;
        const coffeeQuest = turn.coffeeQuest;
        return { conversation: { ...conversation, messages, arrival, ...(seller ? { seller } : {}),
          ...(coffeeQuest ? { coffeeQuest } : {}) }, arrival, correction: turn.correction ?? null, retryMessage: null };
      }).finally(() => {
        streamCancellation = null;
        if (!disposed) update({ streaming: false, streamedReply: '',
          announcement: state.conversation?.messages.at(-1)?.ai ? 'Reply complete.' : '' });
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
    dispose: () => { disposed = true; epoch++; streamCancellation?.abort(); streamCancellation = null;
      state = { ...state, pending: false, streaming: false, streamedReply: '' }; listeners.clear(); },
  };
}
