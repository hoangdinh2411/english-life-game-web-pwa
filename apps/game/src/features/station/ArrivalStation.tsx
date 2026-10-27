import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { PlayerLocation } from '@life-abroad/shared';
import * as api from '../../api/client';
import { useSession } from '../../session/session-provider';
import StationScreen from '../../gameplay/StationScreen';
import { Screen, ActionButton } from '../../components/onboarding-ui';
import { createConversationController } from '../dialogue/conversation-controller';
import { SavedConversation } from '../dialogue/SavedConversation';
import { ArrivalQuest, TicketReceipt } from './ArrivalQuest';
import { arrivalPresentation } from './arrival-presentation';
import { usePwa } from '../../pwa/PwaProvider';
import { router } from '../../navigation/router';
import { useLife } from '../life/useLife';
import { streamChat } from '../dialogue/chat-stream';
import { clearPendingPlayerLocation, createPlayerLocationSync, readPendingPlayerLocation } from '../location/player-location-sync';
import { loadWithoutWaitingForCleanup } from './startup-cleanup';

export default function ArrivalStation({ onSignOut }: { onSignOut: () => void }) {
  const session = useSession();
  const { online } = usePwa();
  const run = session.runAuthenticated;
  const life = useLife(run, online);
  const [controller] = useState(() => createConversationController({
    load: () => run(api.loadArrival), start: () => run(api.startArrivalConversation),
    loadOlder: (npcId, before) => run(token => api.loadOlderConversationMessages(token, npcId, before)),
    send: async (id, body) => {
      const result = await run((token) => api.sendArrivalMessage(token, id, body));
      await life.refresh();
      return result;
    },
    stream: async (id, npcId, body, onToken, signal) => {
      const result = await run(token => streamChat(token, { ...body, conversationId: id, npcId }, onToken, signal));
      await life.refresh();
      return result;
    },
    enter: () => run(api.enterTownStreet),
  }));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [initialLocation, setInitialLocation] = useState<PlayerLocation | null>(null);
  const locationSync = useRef<ReturnType<typeof createPlayerLocationSync> | null>(null);
  const [stats, setStats] = useState(session.player?.stats);
  const [statsError, setStatsError] = useState('');
  const [locationError, setLocationError] = useState('');
  const refreshStats = async () => {
    try { const player = await run(api.loadPlayer); setStats(player.stats); setStatsError(''); }
    catch { setStatsError('Your arrival rewards are saved. Reconnect to refresh the displayed balances.'); }
  };
  const initializeLocation = (serverLocation: PlayerLocation) => {
    const userId = session.player!.user.id;
    const pending = readPendingPlayerLocation(userId, localStorage);
    const location = pending ?? serverLocation;
    locationSync.current?.dispose();
    locationSync.current = createPlayerLocationSync({
      userId, initialLocation: location, storage: localStorage,
      save: async (nextLocation) => {
        try {
          await run(token => api.savePlayerLocation(token, nextLocation));
          setLocationError('');
        } catch (error) {
          setLocationError('Your current place is saved on this device and will sync when the connection recovers.');
          throw error;
        }
      },
    });
    setInitialLocation(location);
    if (pending) void locationSync.current.flush().catch(() => undefined);
  };
  useEffect(() => {
    let active = true;
    void loadWithoutWaitingForCleanup(
      controller.load,
      [() => run(api.resetIdCardApplication), () => run(api.discardTransientConversations)],
    ).then((loaded) => {
      if (active && loaded) initializeLocation(session.player?.character?.lastLocation ?? {
        mapId: controller.getSnapshot().arrival?.locationId === 'loc_town_street' ? 'loc_town_street' : 'loc_station',
        placeId: controller.getSnapshot().arrival?.locationId === 'loc_town_street' ? 'loc_town_street' : 'loc_station',
        x: controller.getSnapshot().arrival?.locationId === 'loc_town_street' ? 1152 : 768,
        y: controller.getSnapshot().arrival?.locationId === 'loc_town_street' ? 315 : 370,
      });
    });
    return () => { active = false; locationSync.current?.dispose(); controller.dispose(); };
  }, [controller]);
  useEffect(() => {
    const flushHiddenLocation = () => { if (document.hidden) void locationSync.current?.flush().catch(() => undefined); };
    document.addEventListener('visibilitychange', flushHiddenLocation);
    return () => document.removeEventListener('visibilitychange', flushHiddenLocation);
  }, []);
  const retryLoad = async () => {
    if (await loadWithoutWaitingForCleanup(
      controller.load,
      [() => run(api.resetIdCardApplication), () => run(api.discardTransientConversations)],
    )) initializeLocation(session.player?.character?.lastLocation ?? {
      mapId: controller.getSnapshot().arrival?.locationId === 'loc_town_street' ? 'loc_town_street' : 'loc_station',
      placeId: controller.getSnapshot().arrival?.locationId === 'loc_town_street' ? 'loc_town_street' : 'loc_station',
      x: controller.getSnapshot().arrival?.locationId === 'loc_town_street' ? 1152 : 768,
      y: controller.getSnapshot().arrival?.locationId === 'loc_town_street' ? 315 : 370,
    });
  };
  if (!state.arrival || !initialLocation) return <Screen>
    <p role={state.error ? 'alert' : 'status'}>{state.error || 'Loading your saved arrival…'}</p>
    {state.error ? <ActionButton label="Try again" onClick={() => void retryLoad()} /> : null}
    <ActionButton label="Try local station practice" secondary onClick={() => router.push('/practice')} />
    <ActionButton label="Sign out" secondary onClick={onSignOut} />
  </Screen>;
  const view = arrivalPresentation(state.arrival);
  return <StationScreen life={life} playerName={session.player?.character?.name ?? ''} gender={session.player?.character?.gender}
    countryName={session.player?.character?.countryName} xp={stats?.xp ?? 0} coins={life.state?.coins ?? stats?.coins ?? 0}
    onSignOut={() => { clearPendingPlayerLocation(session.player!.user.id, localStorage); onSignOut(); }}
    arrival={{ initialLocation, exitUnlocked: state.arrival.canEnterTownStreet, pending: state.pending,
      farewellConfirm: state.farewellStage === 'confirm',
      error: state.error, onRetry: () => void controller.load(), online,
      goalsLabel: state.arrival.status === 'done' ? 'Arrival complete' : `${view.completed}/${view.total} arrival steps`,
      questPanel: <ArrivalQuest arrival={state.arrival} />,
      blockedExitMessage: `${view.next}. Get a bus ticket from the receptionist before leaving for Town Street.`,
      statusPanel: <>{!online ? <div className="arrival-connection absolute z-[3] top-15 left-2 right-2 max-w-[720px] m-auto bg-dialogue p-2.5 rounded-[12px] text-[14px] [&_button]:ml-2 [&_button]:text-ink [&_button]:bg-transparent [&_button]:[border:1px_solid_var(--color-border)] [&_button]:rounded-[8px]" role="alert">You’re offline. Saved dialogue and ticket use need a connection. <button type="button" onClick={() => router.push('/practice')}>Try local practice</button></div> : null}{statsError || locationError ? <div className="arrival-connection absolute z-[3] top-15 left-2 right-2 max-w-[720px] m-auto bg-dialogue p-2.5 rounded-[12px] text-[14px] [&_button]:ml-2 [&_button]:text-ink [&_button]:bg-transparent [&_button]:[border:1px_solid_var(--color-border)] [&_button]:rounded-[8px]" role="status">{locationError || statsError}{statsError ? <button type="button" disabled={!online} onClick={() => void refreshStats()}>Refresh balances</button> : null}</div> : null}</>,
      onOpenReceptionist: () => void controller.start(),
      onEnterStreet: async () => {
        const entered = await controller.enter();
        if (entered) {
          // Refresh displayed balances from /me; never calculate rewards on the client.
          await refreshStats();
          await life.refresh();
        }
        return entered;
      },
      onPlaceChange: (location) => {
        locationSync.current?.update(location);
      },
      renderReceptionist: (sound, onClose) => <SavedConversation gender={session.player?.character?.gender} state={state} sound={sound} online={online} send={controller.send} loadOlder={controller.loadOlder} retry={() => void controller.start()} onClose={onClose}
        completed={state.arrival?.status === 'done'} details={<>{state.arrival?.ticket.issued ? <TicketReceipt arrival={state.arrival} /> : null}<p className="dialogue-hint text-[var(--color-hint)] text-[14px] leading-[1.4]">{view.next}</p></>} />,
    }} />;
}
