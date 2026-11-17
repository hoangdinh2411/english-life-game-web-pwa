import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { CAFE_SELLER_NPC_IDS, type CoffeeQuestState, type PlayerGender, type JobTicket, type JobShiftReport } from '@life-abroad/shared';
import { useSession } from '../../session/session-provider';
import { usePwa } from '../../pwa/PwaProvider';
import { discardConversation, loadArrival, loadOlderConversationMessages, openConversation, sendArrivalMessage } from '../../api/client';
import { createConversationController, scheduleConversationStart } from '../dialogue/conversation-controller';
import { SavedConversation } from '../dialogue/SavedConversation';
import { DialogueFrame } from '../../gameplay/DialogueFrame';
import { GameButton } from '../../gameplay/GameButton';
import { SHOP_NPCS, type ShopNpcId } from './shop-npcs';
import { CoffeeQuestToast, shouldShowCoffeeQuestToast } from './CoffeeQuest';
import { ShopMenuPanel } from './ShopMenuPanel';
import { sellerPanelVisibility } from './seller-panel-visibility';
import { streamChat } from '../dialogue/chat-stream';
import { NPC_PORTRAIT_GRID, npcPortrait, npcPortraitPosition } from '../npcs/npc-portraits';
import { ConversationOpeningIndicator } from '../dialogue/ConversationOpeningIndicator';
import { usePreferences } from '../hud/usePreferences';
import { JobShellModal } from '../jobs/components/JobShellModal';

export function ShopConversation({ gender, npcId, sound, onClose, onRefresh }: {
  gender?: PlayerGender | undefined; npcId: ShopNpcId; sound: boolean; onClose: () => void; onRefresh: () => Promise<void>;
}) {
  const { runAuthenticated: run, refreshPlayer } = useSession();
  const { online } = usePwa();
  const { userMode } = usePreferences();
  const [ordersRefreshKey, setOrdersRefreshKey] = useState(0);
  const [questToast, setQuestToast] = useState<CoffeeQuestState | null>(null);
  const [activeJobTicket, setActiveJobTicket] = useState<JobTicket | null>(null);
  const dismissQuestToast = useCallback(() => setQuestToast(null), []);
  const [controller] = useState(() => createConversationController({
    load: () => run(loadArrival),
    start: () => run(token => openConversation(token, npcId, sound)),
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
  useEffect(() => scheduleConversationStart(controller), [controller]);
  const npc = SHOP_NPCS.find(npc => npc.id === npcId)!;
  const panelVisibility = sellerPanelVisibility(state.conversation?.messages ?? []);
  const confirmationOnly = state.farewellStage === 'confirm';
  const close = () => {
    const id = controller.getSnapshot().conversation?.id;
    onClose();
    if (id) void run(token => discardConversation(token, id)).catch(() => undefined);
  };
  const isCafeSeller = (CAFE_SELLER_NPC_IDS as readonly string[]).includes(npcId);

  const sampleJobTicket: JobTicket = {
    ticketId: `ticket_icecream_${Date.now()}`,
    jobId: "job_ice_cream",
    customerName: npc.name,
    orderPromptEnglish: "I'd like a waffle cone with strawberry and vanilla scoop, please!",
    targetSequence: ["cone", "strawberry", "vanilla"],
    exclusions: ["chocolate"],
    rewardCoins: 10,
    rewardXp: 15,
  };

  const handleJobFinish = async (report: JobShiftReport) => {
    setActiveJobTicket(null);
    const replyText = userMode === "kid"
      ? `Here is your sweet ice cream! (${report.stars} ⭐)`
      : `Here is your completed order. Enjoy!`;
    await send(replyText);
  };

  const jobAction = isCafeSeller ? (
    <div className="pt-1">
      <GameButton
        label={userMode === "kid" ? "🍨 Help prepare ice cream!" : "☕ Take Practice Shift"}
        onClick={() => setActiveJobTicket(sampleJobTicket)}
      />
    </div>
  ) : null;

  const details = <>
    {isCafeSeller ? <ShopMenuPanel refreshKey={ordersRefreshKey} showMenu={panelVisibility.menu} showOrders={panelVisibility.orders} /> : null}
  </>;
  if (!state.conversation && !state.error) return <ConversationOpeningIndicator
    npcName={npc.name}
    portrait={npcPortrait(npc.id)}
  />;
  return <>
    <DialogueFrame soundControl={!confirmationOnly} confirmationOnly={confirmationOnly}>
      {!confirmationOnly ? <div className="dialogue-header"><h2>{npc.name}</h2></div> : null}
      <SavedConversation gender={gender} state={state} sound={sound} online={online} send={send} loadOlder={controller.loadOlder}
        onClose={close}
        details={details}
        actions={jobAction}
        retry={() => void controller.start()} displayNpc={{
          name: npc.name,
          portrait: npcPortrait(npc.id),
          portraitPosition: npcPortraitPosition,
          portraitGrid: NPC_PORTRAIT_GRID,
        }} />
    </DialogueFrame>
    {questToast ? <CoffeeQuestToast quest={questToast} onDismiss={dismissQuestToast} /> : null}
    {activeJobTicket ? (
      <JobShellModal
        ticket={activeJobTicket}
        userMode={userMode}
        onClose={() => setActiveJobTicket(null)}
        onJobFinish={handleJobFinish}
      />
    ) : null}
  </>;
}
