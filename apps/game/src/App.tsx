import { lazy, Suspense, useEffect } from 'react';
import { SessionProvider, useSession } from './session/session-provider';
import { Redirect, router, usePath } from './navigation/router';
import { resolveRoute } from './navigation/route-policy';
import { usePwa } from './pwa/PwaProvider';
import { PwaStatus } from './pwa/PwaStatus';
import { ActionButton, Heading, Screen } from './components/onboarding-ui';
import SignIn from './app/sign-in';
import NewGame from './app/new-game';
import City from './app/new-game/city';
import Avatar from './app/new-game/avatar';
import Name from './app/new-game/name';
import Review from './app/new-game/review';
const Home = lazy(() => import('./app/home'));
const Station = lazy(() => import('./gameplay/StationScreen'));
export default function App() {
  return <SessionProvider><SessionRoutes /></SessionProvider>;
}
function SessionRoutes() {
  const session = useSession();
  const pwa = usePwa();
  const path = usePath();
  const route = resolveRoute(path, { token: session.token, hasCharacter: Boolean(session.player?.character), online: pwa.online });
  const practice = route === '/practice';
  const playing = practice || route === '/home';
  useEffect(() => { if (!pwa.online && route === '/practice' && path !== '/practice') router.replace('/practice'); }, [pwa.online, route, path]);
  useEffect(() => { if (!playing) document.querySelector<HTMLElement>('h1')?.focus(); }, [path, playing]);
  let content;
  if (practice) content = <Station playerName="Newcomer" xp={0} coins={0} practice onSignOut={() => router.replace(pwa.online ? '/' : '/sign-in')} />;
  else if (!session.ready || session.playerLoading) content = <Screen><p role="status">Checking your session…</p><ActionButton label="Try local station practice" onClick={() => router.push('/practice')} /></Screen>;
  else if (session.token && session.playerError) content = <Screen><Heading title="Your game could not load" subtitle={session.playerError} /><ActionButton label="Try again" onClick={() => void session.refreshPlayer().catch(() => undefined)} /><ActionButton label="Try local station practice" secondary onClick={() => router.push('/practice')} /><ActionButton label="Sign out" secondary onClick={() => void session.signOut()} /></Screen>;
  else if (route !== path) content = <Redirect href={route} />;
  else {
    const screens: Record<string, React.ReactNode> = { '/sign-in': <SignIn />, '/new-game': <NewGame />, '/new-game/city': <City />, '/new-game/avatar': <Avatar />, '/new-game/name': <Name />, '/new-game/review': <Review />, '/home': <Home /> };
    content = screens[route];
  }
  return <div className="app-shell"><PwaStatus playing={playing} />
    {practice ? <div className="practice-status">Local practice · No saved progress or rewards. <button type="button" onClick={() => router.replace('/sign-in')}>Back to sign in</button></div> : null}
    <Suspense fallback={<Screen><p role="status">Loading the game…</p></Screen>}>{content}</Suspense>
  </div>;
}
