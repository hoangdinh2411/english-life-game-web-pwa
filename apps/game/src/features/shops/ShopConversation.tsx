import { useEffect, useState, useSyncExternalStore } from 'react';
import { conversationSchema } from '@life-abroad/shared';
import { useSession } from '../../session/session-provider';
import { usePwa } from '../../pwa/PwaProvider';
import { loadArrival, request, sendArrivalMessage } from '../../api/client';
import { createConversationController } from '../dialogue/conversation-controller';
import { SavedConversation } from '../dialogue/SavedConversation';
import { DialogueFrame } from '../../gameplay/DialogueFrame';
import { GameButton } from '../../gameplay/GameButton';
import { SHOP_NPCS, type ShopNpcId } from './shop-npcs';
import shopPortraits from '../../../assets/npcs/shop-npcs.png';
import { CoffeeQuest } from './CoffeeQuest';

export function ShopConversation({ npcId, sound, onClose, onRefresh }: {
  npcId: ShopNpcId; sound: boolean; onClose: () => void; onRefresh: () => Promise<void>;
}) {
  const { runAuthenticated: run, refreshPlayer } = useSession();
  const { online } = usePwa();
  const [controller] = useState(() => createConversationController({
    load: () => run(loadArrival),
    start: () => run(async token => conversationSchema.parse(await request('conversations', { npcId }, token))),
    read: id => run(async token => conversationSchema.parse(await request(`conversations/${encodeURIComponent(id)}`, undefined, token))),
    send: async (id, body) => {
      const turn = await run(token => sendArrivalMessage(token, id, body));
      await onRefresh();
      if (turn.intent === 'paid') await refreshPlayer(true);
      return turn;
    },
  }));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  useEffect(() => {
    void controller.load().then(loaded => { if (loaded) void controller.start(); });
    return controller.dispose;
  }, [controller]);
  const npc = SHOP_NPCS.find(npc => npc.id === npcId)!;
  return <DialogueFrame>
    <div className="dialogue-header flex items-center justify-between gap-2"><h2>{npc.name}</h2><GameButton label="Close" disabled={state.pending} onClick={onClose} /></div>
    <SavedConversation state={state} sound={sound} online={online} send={controller.send}
      details={state.conversation?.coffeeQuest ? <CoffeeQuest quest={state.conversation.coffeeQuest} /> : undefined}
      retry={() => void controller.start()} shopNpc={{ name: npc.name, portrait: shopPortraits, portraitPosition: `${SHOP_NPCS.indexOf(npc) % 3 * 50}% ${Math.floor(SHOP_NPCS.indexOf(npc) / 3) * 100}%` }} />
  </DialogueFrame>;
}
