import { router } from '../../navigation/router';
import { ActionButton, Heading, Screen } from '../../components/onboarding-ui';
import { useSession } from '../../session/session-provider';

export default function NewGameScreen() {
  const session = useSession();
  return <Screen><Heading title="Welcome to a new life" subtitle="A fresh start, a friendly town, and a whole new story. First, let's make a character who feels like you." />
    <ActionButton label="Start a new life" onClick={() => router.push('/new-game/country')} />
    <ActionButton label="Sign out" secondary onClick={() => { void session.signOut().then(() => router.replace('/sign-in')); }} />
  </Screen>;
}
