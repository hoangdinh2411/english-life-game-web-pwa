import { useEffect, useState, useSyncExternalStore } from 'react';
import { usePwa } from '../../pwa/PwaProvider';
import { useSession } from '../../session/session-provider';
import { issueIdCard, loadArrival, loadOlderConversationMessages, openConversation, sendArrivalMessage } from '../../api/client';
import { DialogueFrame } from '../../gameplay/DialogueFrame';
import { SavedConversation } from '../dialogue/SavedConversation';
import { createConversationController } from '../dialogue/conversation-controller';
import type { PlayerGender } from '@life-abroad/shared';
import { conversationNpcSchema } from '@life-abroad/shared';
import { streamChat } from '../dialogue/chat-stream';
import { NPC_PORTRAIT_GRID, npcPortrait, npcPortraitPosition } from './npc-portraits';
import { countryResidentHint } from '../location/country-presentation';
import { useIdCardPhotoFlow } from '../id-card/use-id-card-photo-flow';

export function TownspersonConversation({ gender, npc, sound, countryName, onClose, onRefresh }: {
  gender?: PlayerGender | undefined;
  npc: Readonly<{ id: string; name: string; job: string }>;
  sound: boolean;
  countryName?: string | undefined;
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
  const photoFlow = useIdCardPhotoFlow({ application: state.conversation?.idCardApplication, gender,
    send: controller.send,
    issue: async (photo, idempotencyKey) => {
      const current = controller.getSnapshot();
      if (!current.idCardSubmitReady || !current.conversation) throw new Error('Confirm the application with the staff member first.');
      await run(token => issueIdCard(token, { conversationId: current.conversation!.id, idempotencyKey }, photo));
      controller.clearIdCardSubmit();
      await onRefresh();
    } });
  const confirmationOnly = state.farewellStage === 'confirm';
  return <DialogueFrame soundControl={!confirmationOnly} confirmationOnly={confirmationOnly}>
    {!confirmationOnly ? <div className="dialogue-header">
      <div className="min-w-0"><h2>{npc.name}</h2><p className="dialogue-hint text-[var(--color-hint)] text-[14px] leading-[1.4]">{npc.job}</p></div>
    </div> : null}
    <SavedConversation gender={gender} state={state} sound={sound} online={online}
      send={photoFlow.send} loadOlder={controller.loadOlder} retry={() => void controller.start()} onClose={onClose}
      actions={photoFlow.actions} composerHidden={photoFlow.composerHidden}
      displayNpc={{
        name: npc.name,
        portrait: npcPortrait(npc.id),
        portraitPosition: npcPortraitPosition,
        portraitGrid: NPC_PORTRAIT_GRID,
      }}
      hint={countryResidentHint(countryName)} />
  </DialogueFrame>;
}
