import { useEffect, useState, useSyncExternalStore } from 'react';
import * as api from '../../api/client';
import { useSession } from '../../session/session-provider';
import StationScreen from '../../gameplay/StationScreen';
import { Screen, ActionButton } from '../../components/onboarding-ui';
import { createArrivalController } from './arrival-controller';
import { ArrivalConversation } from './ArrivalConversation';

export default function ArrivalStation({ onSignOut }: { onSignOut: () => void }) {
  const session = useSession();
  const run = session.runAuthenticated;
  const [controller] = useState(() => createArrivalController({
    load: () => run(api.loadArrival), start: () => run(api.startArrivalConversation),
    send: (id, body) => run((token) => api.sendArrivalMessage(token, id, body)),
    enter: () => run(api.enterTownStreet),
  }));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [initialLocation, setInitialLocation] = useState<'station' | 'street' | null>(null);
  const [stats, setStats] = useState(session.player?.stats);
  useEffect(() => {
    let active = true;
    void controller.load().then((loaded) => {
      if (active && loaded) setInitialLocation(controller.getSnapshot().arrival?.locationId === 'loc_town_street' ? 'street' : 'station');
    });
    return () => { active = false; controller.dispose(); };
  }, [controller]);
  const retryLoad = async () => {
    if (await controller.load()) setInitialLocation(controller.getSnapshot().arrival?.locationId === 'loc_town_street' ? 'street' : 'station');
  };
  if (!state.arrival || !initialLocation) return <Screen>
    <p role={state.error ? 'alert' : 'status'}>{state.error || 'Loading your saved arrival…'}</p>
    {state.error ? <ActionButton label="Try again" onClick={() => void retryLoad()} /> : null}
    <ActionButton label="Sign out" secondary onClick={onSignOut} />
  </Screen>;
  return <StationScreen playerName={session.player?.character?.name ?? ''} xp={stats?.xp ?? 0} coins={stats?.coins ?? 0} onSignOut={onSignOut}
    arrival={{ initialLocation, exitUnlocked: state.arrival.canEnterTownStreet, pending: state.pending,
      error: state.error, onRetry: () => void controller.load(),
      onOpenReceptionist: () => void controller.start(),
      onEnterStreet: async () => {
        const entered = await controller.enter();
        if (entered) {
          // Refresh displayed balances from /me; never calculate rewards on the client.
          await run(api.loadPlayer).then((player) => setStats(player.stats)).catch(() => undefined);
        }
        return entered;
      },
      renderReceptionist: (sound) => <ArrivalConversation state={state} sound={sound} send={controller.send} retry={() => void controller.start()} />,
    }} />;
}
