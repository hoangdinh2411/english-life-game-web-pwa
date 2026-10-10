import { Redirect, router } from '../navigation/router';
import { useSession } from '../session/session-provider';
import ArrivalStation from '../features/station/ArrivalStation';
export default function HomeScreen() {
  const session = useSession();
  if (!session.player?.character) return <Redirect href="/new-game" />;
  return <ArrivalStation key={session.player.user.id}
    onSignOut={() => { void session.signOut().then(() => router.replace('/sign-in')); }} />;
}
