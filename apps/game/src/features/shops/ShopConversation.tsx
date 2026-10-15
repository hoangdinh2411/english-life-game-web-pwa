import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { CAFE_SELLER_NPC_IDS, conversationSchema, type CoffeeQuestState } from '@life-abroad/shared';
import { useSession } from '../../session/session-provider';
import { usePwa } from '../../pwa/PwaProvider';
import { loadArrival, request, sendArrivalMessage } from '../../api/client';
import { createConversationController } from '../dialogue/conversation-controller';
import { SavedConversation } from '../dialogue/SavedConversation';
import { DialogueFrame } from '../../gameplay/DialogueFrame';
import { GameButton } from '../../gameplay/GameButton';
import { SHOP_NPCS, type ShopNpcId } from './shop-npcs';
import shopPortraits from '../../../assets/npcs/shop-npcs.png';
import { CoffeeQuestToast, shouldShowCoffeeQuestToast } from './CoffeeQuest';
import { ShopMenuPanel } from './ShopMenuPanel';
import { sellerPanelVisibility } from './seller-panel-visibility';

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
    start: () => run(async token => conversationSchema.parse(await request('conversations', { npcId }, token))),
    send: async (id, body) => {
      const turn = await run(token => sendArrivalMessage(token, id, body));
      await onRefresh();
      if (turn.intent === 'paid') {
        await refreshPlayer(true);
        setOrdersRefreshKey(value => value + 1);
      }
      return turn;
    },
  }));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const send = async (text: string, coach: boolean) => {
    const previousQuest = controller.getSnapshot().conversation?.coffeeQuest;
    const sent = await controller.send(text, coach);
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
  const isCafeSeller = (CAFE_SELLER_NPC_IDS as readonly string[]).includes(npcId);
  const details = <>
    {isCafeSeller ? <ShopMenuPanel refreshKey={ordersRefreshKey} showMenu={panelVisibility.menu} showOrders={panelVisibility.orders} /> : null}
  </>;
  return <>
    <DialogueFrame soundControl>
      <div className="dialogue-header flex items-center justify-between gap-2"><h2>{npc.name}</h2><GameButton label="Close" disabled={state.pending} onClick={onClose} /></div>
      <SavedConversation state={state} sound={sound} online={online} send={send}
        details={details}
        retry={() => void controller.start()} displayNpc={{ name: npc.name, portrait: shopPortraits, portraitPosition: `${SHOP_NPCS.indexOf(npc) % 3 * 50}% ${Math.floor(SHOP_NPCS.indexOf(npc) / 3) * 100}%` }} />
    </DialogueFrame>
    {questToast ? <CoffeeQuestToast quest={questToast} onDismiss={dismissQuestToast} /> : null}
  </>;
}
