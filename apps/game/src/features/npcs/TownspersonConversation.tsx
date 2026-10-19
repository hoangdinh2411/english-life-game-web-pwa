import { useEffect, useState, useSyncExternalStore } from 'react';
import { usePwa } from '../../pwa/PwaProvider';
import { useSession } from '../../session/session-provider';
import { loadArrival, loadOlderConversationMessages, openConversation, sendArrivalMessage } from '../../api/client';
import { DialogueFrame } from '../../gameplay/DialogueFrame';
import { SavedConversation } from '../dialogue/SavedConversation';
import { createConversationController } from '../dialogue/conversation-controller';
import type { StreetNpcContent } from '@life-abroad/shared';
import { conversationNpcSchema } from '@life-abroad/shared';
import { streamChat } from '../dialogue/chat-stream';
import { NPC_PORTRAIT_GRID, npcPortrait, npcPortraitPosition } from './npc-portraits';

export function TownspersonConversation({ npc, sound, onClose, onRefresh }: {
  npc: StreetNpcContent;
  sound: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const { runAuthenticated: run } = useSession();
  const { online } = usePwa();
  const [controller] = useState(() => createConversationController({
    load: () => run(loadArrival),
    start: () => run(token => openConversation(token, conversationNpcSchema.parse(npc.id))),
    loadOlder: (npcId, before) => run(token => loadOlderConversationMessages(token, npcId, before)),
    send: async (id, body) => {
      const turn = await run(token => sendArrivalMessage(token, id, body));
      await onRefresh();
      return turn;
    },
    stream: async (id, npcId, body, onToken, signal) => {
      const turn = await run(token => streamChat(token, { ...body, conversationId: id, npcId }, onToken, signal));
      await onRefresh();
      return turn;
    },
  }));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  useEffect(() => {
    void controller.load().then(loaded => { if (loaded) void controller.start(); });
    return controller.dispose;
  }, [controller]);
  const confirmationOnly = state.farewellStage === 'confirm';
  return <DialogueFrame soundControl={!confirmationOnly} confirmationOnly={confirmationOnly}>
    {!confirmationOnly ? <div className="dialogue-header">
      <div className="min-w-0"><h2>{npc.name}</h2><p className="dialogue-hint text-[#52644f] text-[14px] leading-[1.4]">{npc.job}</p></div>
    </div> : null}
    <SavedConversation state={state} sound={sound} online={online}
      send={controller.send} loadOlder={controller.loadOlder} retry={() => void controller.start()} onClose={onClose}
      displayNpc={{
        name: npc.name,
        portrait: npcPortrait(npc.id),
        portraitPosition: npcPortraitPosition,
        portraitGrid: NPC_PORTRAIT_GRID,
      }}
      hint="Try asking about the weather, hobbies, food or life in Maplewood." />
  </DialogueFrame>;
}
