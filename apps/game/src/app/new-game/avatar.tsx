import { useEffect, useState } from 'react';
import { router } from '../../navigation/router';
import { ActionButton, AvatarPreview, ChoiceCard, Heading, Screen } from '../../components/onboarding-ui';
import { useSession } from '../../session/session-provider';
export default function AvatarScreen() {
  const session = useSession();
  const [message, setMessage] = useState('');
  const countryName = session.options?.countries.find((country) => country.id === session.draft.countryId)?.name ?? '';
  useEffect(() => { if (!session.draft.countryId) router.replace('/new-game/country'); }, [session.draft.countryId]);
  useEffect(() => { if (!session.options) void session.refreshOptions().catch(() => setMessage('Could not load characters. Check your connection and try again.')); }, [session.options, session.refreshOptions]);
  return <Screen><Heading title="Choose your character" subtitle="Pick a look for the beginning of your adventure." />
    {session.options?.avatars.map((avatar) => <ChoiceCard key={avatar.id} title={avatar.label} subtitle={countryName ? `Ready to explore ${countryName}` : 'Choose a character for your new life.'} selected={session.draft.avatarId === avatar.id} onClick={() => session.updateDraft({ avatarId: avatar.id })}><AvatarPreview color={avatar.outfitColor} /></ChoiceCard>)}
    {!session.options ? <p role="status">{message || 'Loading characters…'}</p> : null}
    {message ? <ActionButton label="Try again" secondary onClick={() => { setMessage(''); void session.refreshOptions().catch(() => setMessage('Could not load characters. Check your connection and try again.')); }} /> : null}
    <ActionButton label="Continue" disabled={!session.options?.avatars.some((avatar) => avatar.id === session.draft.avatarId)} onClick={() => router.push('/new-game/name')} />
    <ActionButton label="Back" secondary onClick={() => router.replace('/new-game/country')} />
  </Screen>;
}
