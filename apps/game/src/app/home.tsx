import { Redirect, router } from '../navigation/router';
import { useSession } from '../session/session-provider';
import StationScreen from '../gameplay/StationScreen';
export default function HomeScreen() {
  const session = useSession();
  if (!session.player?.character) return <Redirect href="/new-game" />;
  return <StationScreen playerName={session.player.character.name} xp={session.player.stats?.xp ?? 0} coins={session.player.stats?.coins ?? 0}
    onSignOut={() => { void session.signOut().then(() => router.replace('/sign-in')); }} />;
}
