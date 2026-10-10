import { useEffect, useState } from 'react';
import { router } from '../../navigation/router';
import { ActionButton, AvatarPreview, Heading, Screen } from '../../components/onboarding-ui';
import { validateCharacterName } from '../../onboarding/onboarding-state';
import { useSession } from '../../session/session-provider';
export default function NameScreen() {
  const session = useSession();
  const [name, setName] = useState(session.draft.name ?? '');
  const [attempted, setAttempted] = useState(false);
  useEffect(() => { if (!session.draft.avatarId || !session.draft.cityId) router.replace('/new-game/city'); }, [session.draft.avatarId, session.draft.cityId]);
  const message = attempted ? validateCharacterName(name) : null;
  const avatar = session.options?.avatars.find((item) => item.id === session.draft.avatarId);
  return <Screen><Heading title="What is your name?" subtitle="Choose the name people in town will use for you." />
    {avatar ? <AvatarPreview large color={avatar.outfitColor} /> : null}
    <form className="form-stack" onSubmit={(event) => { event.preventDefault(); setAttempted(true); if (validateCharacterName(name)) return; session.updateDraft({ name }); router.push('/new-game/review'); }}>
      <label>Character name<input aria-describedby="name-help" aria-invalid={Boolean(message)} value={name} onChange={(event) => { setName(event.target.value); session.updateDraft({ name: event.target.value }); }} onBlur={() => setAttempted(true)} autoCapitalize="words" maxLength={2000} placeholder="Enter a name" /></label>
      <p id="name-help" role={message ? 'alert' : undefined} className={message ? 'error' : 'hint'}>{message ?? 'Your name can use any language.'}</p>
      <button type="submit" className="action-button">Review my choices</button>
    </form>
    <ActionButton label="Back" secondary onClick={() => router.replace('/new-game/avatar')} />
  </Screen>;
}
