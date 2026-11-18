import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AIRPORT_AGENT_NPC_ID, conversationNpcSchema, type PlayerGender } from '@life-abroad/shared';
import { usePwa } from '../../pwa/PwaProvider';
import { useSession } from '../../session/session-provider';
import {
  discardConversation,
  loadArrival,
  loadOlderConversationMessages,
  loadOptions,
  openConversation,
  sendArrivalMessage,
  setDestinationCountry,
} from '../../api/client';
import { DialogueFrame } from '../../gameplay/DialogueFrame';
import { SavedConversation } from '../dialogue/SavedConversation';
import { createConversationController, scheduleConversationStart, shouldCloseAfterNpcPresentation } from '../dialogue/conversation-controller';
import { streamChat } from '../dialogue/chat-stream';
import { ConversationOpeningIndicator } from '../dialogue/ConversationOpeningIndicator';
import { NPC_PORTRAIT_GRID, npcPortrait, npcPortraitPosition } from './npc-portraits';
import { createAirportSendHandler, matchCountry, type CountryOption } from './airport-country';

export { createAirportSendHandler, matchCountry, type CountryOption };

const AIRPORT_AGENT_DISPLAY = {
  id: AIRPORT_AGENT_NPC_ID,
  name: 'Claire',
  job: 'Check-in Agent',
} as const;

export function AirportConversation({ gender, sound, onClose, onRefresh, onDestinationSelected }: {
  gender?: PlayerGender | undefined;
  sound: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onDestinationSelected: () => void;
}) {
  const { runAuthenticated: run } = useSession();
  const { online } = usePwa();
  const countriesRef = useRef<readonly CountryOption[]>([]);
  const destinationLockedRef = useRef(false);

  const [controller] = useState(() => createConversationController({
    load: () => run(loadArrival),
    start: () => run(token => openConversation(token, conversationNpcSchema.parse(AIRPORT_AGENT_NPC_ID), sound)),
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
  const closing = useRef(false);
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    const id = controller.getSnapshot().conversation?.id;
    onClose();
    if (id) void run(token => discardConversation(token, id)).catch(() => undefined);
  }, [controller, onClose, run]);

  const markNpcMessagePresented = useCallback((messageId: string) => {
    if (shouldCloseAfterNpcPresentation(controller.getSnapshot(), messageId)) close();
  }, [close, controller]);

  useEffect(() => scheduleConversationStart(controller), [controller]);
  useEffect(() => {
    let cancelled = false;
    void run(loadOptions).then((options) => {
      if (!cancelled) countriesRef.current = options.countries;
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [run]);

  const send = useCallback((text: string) => createAirportSendHandler({
    getCountries: () => countriesRef.current,
    loadCountries: async () => {
      const options = await run(loadOptions);
      countriesRef.current = options.countries;
      return options.countries;
    },
    isDestinationLocked: () => destinationLockedRef.current,
    lockCountry: async (countryId) => {
      await run(token => setDestinationCountry(token, countryId));
      destinationLockedRef.current = true;
    },
    onRefresh,
    onDestinationSelected,
    send: controller.send,
  })(text), [controller, onDestinationSelected, onRefresh, run]);

  const confirmationOnly = state.farewellStage === 'confirm';
  if (!state.conversation && !state.error) {
    return <ConversationOpeningIndicator npcName={AIRPORT_AGENT_DISPLAY.name} portrait={npcPortrait(AIRPORT_AGENT_NPC_ID)} />;
  }

  return <DialogueFrame soundControl={!confirmationOnly} confirmationOnly={confirmationOnly}>
    {!confirmationOnly ? <div className="dialogue-header">
      <div className="min-w-0">
        <h2>{AIRPORT_AGENT_DISPLAY.name}</h2>
        <p className="dialogue-hint text-[var(--color-hint)] text-[14px] leading-[1.4]">{AIRPORT_AGENT_DISPLAY.job}</p>
      </div>
    </div> : null}
    <SavedConversation
      gender={gender}
      state={state}
      sound={sound}
      online={online}
      send={send}
      loadOlder={controller.loadOlder}
      retry={() => void controller.start()}
      onClose={close}
      composerHidden={state.closeRequested}
      onNpcMessagePresented={markNpcMessagePresented}
      displayNpc={{
        name: AIRPORT_AGENT_DISPLAY.name,
        portrait: npcPortrait(AIRPORT_AGENT_NPC_ID),
        portraitPosition: npcPortraitPosition,
        portraitGrid: NPC_PORTRAIT_GRID,
      }}
      hint="Tell Claire which country you are flying to."
    />
  </DialogueFrame>;
}
