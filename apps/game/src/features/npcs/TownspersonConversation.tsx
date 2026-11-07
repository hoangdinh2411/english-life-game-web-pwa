import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { usePwa } from '../../pwa/PwaProvider';
import { useSession } from '../../session/session-provider';
import { discardConversation, issueIdCard, loadArrival, loadOlderConversationMessages, openConversation, sendArrivalMessage } from '../../api/client';
import { DialogueFrame } from '../../gameplay/DialogueFrame';
import { SavedConversation } from '../dialogue/SavedConversation';
import { createConversationController, scheduleConversationStart, shouldCloseAfterNpcPresentation } from '../dialogue/conversation-controller';
import type { PlayerGender } from '@life-abroad/shared';
import { conversationNpcSchema } from '@life-abroad/shared';
import { streamChat } from '../dialogue/chat-stream';
import { NPC_PORTRAIT_GRID, npcPortrait, npcPortraitPosition } from './npc-portraits';
import { countryResidentHint } from '../location/country-presentation';
import { useIdCardPhotoFlow } from '../id-card/use-id-card-photo-flow';
import { ConversationOpeningIndicator } from '../dialogue/ConversationOpeningIndicator';

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
    start: () => run(token => openConversation(token, conversationNpcSchema.parse(npc.id), sound)),
    loadOlder: (npcId, before) => run(token => loadOlderConversationMessages(token, npcId, before)),
    send: async (id, body) => {
      const turn = await run(token => sendArrivalMessage(token, id, body));
      if (!turn.idCardSubmit) await onRefresh();
      return turn;
    },
    stream: async (id, npcId, body, onToken, signal) => {
      const turn = await run(token => streamChat(token, { ...body, conversationId: id, npcId }, onToken, signal));
      if (!turn.idCardSubmit) await onRefresh();
      return turn;
    },
  }));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [playerPortraitUrl, setPlayerPortraitUrl] = useState<string>();
  const closing = useRef(false);
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    const id = controller.getSnapshot().conversation?.id;
    onClose();
    if (id) void run(token => discardConversation(token, id)).catch(() => undefined);
  }, [controller, onClose, run]);
  const presentedNpcIds = useRef(new Set<string>());
  const presentationWaiters = useRef(new Map<string, () => void>());
  const markNpcMessagePresented = useCallback((messageId: string) => {
    presentedNpcIds.current.add(messageId);
    presentationWaiters.current.get(messageId)?.();
    presentationWaiters.current.delete(messageId);
    if (shouldCloseAfterNpcPresentation(controller.getSnapshot(), messageId)) close();
  }, [close, controller]);
  const waitForAcknowledgement = useCallback((): Promise<string | undefined> => {
    const messageId = controller.getSnapshot().conversation?.messages.findLast(message => message.sender === 'npc')?.id;
    if (!messageId || presentedNpcIds.current.has(messageId)) return Promise.resolve(messageId);
    return new Promise(resolve => { presentationWaiters.current.set(messageId, () => resolve(messageId)); });
  }, [controller]);
  useEffect(() => () => {
    for (const resolve of presentationWaiters.current.values()) resolve();
    presentationWaiters.current.clear();
  }, []);
  useEffect(() => scheduleConversationStart(controller), [controller]);
  const photoFlow = useIdCardPhotoFlow({ application: state.conversation?.idCardApplication, gender,
    send: controller.send,
    waitForAcknowledgement,
    issue: async (photo, idempotencyKey) => {
      const current = controller.getSnapshot();
      if (!current.idCardSubmitReady || !current.conversation) throw new Error('Confirm the application with the staff member first.');
      const result = await run(token => issueIdCard(token, { conversationId: current.conversation!.id, idempotencyKey }, photo));
      controller.completeIdCardIssue(result.npcMessage);
      if (result.photoUrl) setPlayerPortraitUrl(result.photoUrl);
      void onRefresh().catch(() => undefined);
    } });
  const confirmationOnly = state.farewellStage === 'confirm';
  if (!state.conversation && !state.error) return <ConversationOpeningIndicator
    npcName={npc.name}
    portrait={npcPortrait(npc.id)}
  />;
  return <DialogueFrame soundControl={!confirmationOnly} confirmationOnly={confirmationOnly}>
    {!confirmationOnly ? <div className="dialogue-header">
      <div className="min-w-0"><h2>{npc.name}</h2><p className="dialogue-hint text-[var(--color-hint)] text-[14px] leading-[1.4]">{npc.job}</p></div>
    </div> : null}
    <SavedConversation gender={gender} state={state} sound={sound} online={online}
      send={photoFlow.send} loadOlder={controller.loadOlder} retry={() => void controller.start()} onClose={close}
      actions={photoFlow.actions} composerHidden={photoFlow.composerHidden || state.closeRequested}
      reviewPhoto={photoFlow.reviewPhoto}
      {...(photoFlow.issuingMessageId ? { issuingMessageId: photoFlow.issuingMessageId } : {})}
      {...(playerPortraitUrl ? { playerPortraitUrl } : {})}
      onNpcMessagePresented={markNpcMessagePresented}
      displayNpc={{
        name: npc.name,
        portrait: npcPortrait(npc.id),
        portraitPosition: npcPortraitPosition,
        portraitGrid: NPC_PORTRAIT_GRID,
      }}
      hint={countryResidentHint(countryName)} />
  </DialogueFrame>;
}
