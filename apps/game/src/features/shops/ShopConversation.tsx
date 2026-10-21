import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { CAFE_SELLER_NPC_IDS, type CoffeeQuestState } from '@life-abroad/shared';
import { useSession } from '../../session/session-provider';
import { usePwa } from '../../pwa/PwaProvider';
import { loadArrival, loadOlderConversationMessages, openConversation, sendArrivalMessage } from '../../api/client';
import { createConversationController } from '../dialogue/conversation-controller';
import { SavedConversation } from '../dialogue/SavedConversation';
import { DialogueFrame } from '../../gameplay/DialogueFrame';
import { SHOP_NPCS, type ShopNpcId } from './shop-npcs';
import { CoffeeQuestToast, shouldShowCoffeeQuestToast } from './CoffeeQuest';
import { ShopMenuPanel } from './ShopMenuPanel';
import { sellerPanelVisibility } from './seller-panel-visibility';
import { streamChat } from '../dialogue/chat-stream';
import { NPC_PORTRAIT_GRID, npcPortrait, npcPortraitPosition } from '../npcs/npc-portraits';

export function ShopConversation({ npcId, sound, onClose, onRefresh }: {
  npcId: ShopNpcId; sound: boolean; onClose: () => void; onRefresh: () => Promise<void>;
}) {
  const { runAuthenticated: run, refreshPlayer } = useSession();
  const { online } = usePwa();
  const [ordersRefreshKey, setOrdersRefreshKey] = useState(0);
  const [questToast, setQuestToast] = useState<CoffeeQuestState | null>(null);
  const dismissQuestToast = useCallback(() => setQuestToast(null), []);
  const [controller] = useState(() => createConversationController({
    load: () => run(loadArrival),
    start: () => run(token => openConversation(token, npcId)),
    loadOlder: (conversationNpcId, before) => run(token => loadOlderConversationMessages(token, conversationNpcId, before)),
    send: async (id, body) => {
      const turn = await run(token => sendArrivalMessage(token, id, body));
      await onRefresh();
      if (turn.intent === 'paid') {
        await refreshPlayer(true);
        setOrdersRefreshKey(value => value + 1);
      }
      return turn;
    },
    stream: async (id, conversationNpcId, body, onToken, signal) => {
      const turn = await run(token => streamChat(token, { ...body, conversationId: id, npcId: conversationNpcId }, onToken, signal));
      await onRefresh();
      if (turn.intent === 'paid') {
        await refreshPlayer(true);
        setOrdersRefreshKey(value => value + 1);
      }
      return turn;
    },
  }));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const send = async (text: string) => {
    const previousQuest = controller.getSnapshot().conversation?.coffeeQuest;
    const sent = await controller.send(text);
    const currentQuest = controller.getSnapshot().conversation?.coffeeQuest;
    if (sent && shouldShowCoffeeQuestToast(previousQuest, currentQuest)) {
      setQuestToast(currentQuest);
    }
    return sent;
  };
  useEffect(() => {
    void controller.load().then(loaded => { if (loaded) void controller.start(); });
    return controller.dispose;
  }, [controller]);
  const npc = SHOP_NPCS.find(npc => npc.id === npcId)!;
  const panelVisibility = sellerPanelVisibility(state.conversation?.messages ?? []);
  const confirmationOnly = state.farewellStage === 'confirm';
  const isCafeSeller = (CAFE_SELLER_NPC_IDS as readonly string[]).includes(npcId);
  const details = <>
    {isCafeSeller ? <ShopMenuPanel refreshKey={ordersRefreshKey} showMenu={panelVisibility.menu} showOrders={panelVisibility.orders} /> : null}
  </>;
  return <>
    <DialogueFrame soundControl={!confirmationOnly} confirmationOnly={confirmationOnly}>
      {!confirmationOnly ? <div className="dialogue-header"><h2>{npc.name}</h2></div> : null}
      <SavedConversation state={state} sound={sound} online={online} send={send} loadOlder={controller.loadOlder}
        onClose={onClose}
        details={details}
        retry={() => void controller.start()} displayNpc={{
          name: npc.name,
          portrait: npcPortrait(npc.id),
          portraitPosition: npcPortraitPosition,
          portraitGrid: NPC_PORTRAIT_GRID,
        }} />
    </DialogueFrame>
    {questToast ? <CoffeeQuestToast quest={questToast} onDismiss={dismissQuestToast} /> : null}
  </>;
}
