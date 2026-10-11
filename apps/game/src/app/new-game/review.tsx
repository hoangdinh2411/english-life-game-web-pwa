import { useEffect, useRef, useState } from 'react';
import { router } from '../../navigation/router';
import { ActionButton, AvatarPreview, ChoiceCard, Heading, Screen } from '../../components/onboarding-ui';
import { canReview, StartLifeSubmission } from '../../onboarding/onboarding-state';
import { useSession } from '../../session/session-provider';
export default function ReviewScreen() {
  const session = useSession();
  useEffect(() => { if (session.ready && session.player?.character) router.replace('/home'); }, [session.ready, session.player]);
  const lock = useRef(new StartLifeSubmission());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const city = session.options?.cities.find((item) => item.id === session.draft.cityId);
  const avatar = session.options?.avatars.find((item) => item.id === session.draft.avatarId);
  if (!canReview(session.draft) || !city || !avatar) return <Screen><Heading title="Your choices are missing" subtitle="Go back and finish each step." /><ActionButton label="Choose again" onClick={() => router.replace('/new-game/city')} /></Screen>;
  async function startLife() {
    if (busy) return;
    setBusy(true); setMessage('');
    try { if (await lock.current.run(session.startLife)) router.replace('/home'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not start your life. Please try again.'); }
    finally { setBusy(false); }
  }
  return <Screen><Heading title="Your new life" subtitle="Take a look before you begin. You can go back and change anything." />
    <ChoiceCard title={session.draft.name} subtitle="Your character" selected onClick={() => router.push('/new-game/name')}><AvatarPreview color={avatar.outfitColor} /></ChoiceCard>
    <ChoiceCard title={city.name} subtitle={city.description ?? 'Your starting city'} selected onClick={() => router.push('/new-game/city')}><span className="city-preview w-18 h-18 shrink-0 rounded-[16px] bg-[#e5eddd] grid place-items-center text-[32px]" aria-hidden="true">🏡</span></ChoiceCard>
    {message ? <p role="alert" className="error text-[#a43f34] text-[15px] leading-[1.4]">{message}</p> : null}
    <ActionButton label={busy ? 'Starting your life…' : 'Start Life'} disabled={busy} onClick={() => void startLife()} />
    <ActionButton label="Back" disabled={busy} secondary onClick={() => router.replace('/new-game/name')} />
  </Screen>;
}
