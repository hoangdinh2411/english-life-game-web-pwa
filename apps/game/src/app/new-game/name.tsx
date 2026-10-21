import { useEffect, useState } from 'react';
import { router } from '../../navigation/router';
import { ActionButton, AvatarPreview, Heading, Screen } from '../../components/onboarding-ui';
import { validateCharacterName } from '../../onboarding/onboarding-state';
import { useSession } from '../../session/session-provider';
export default function NameScreen() {
  const session = useSession();
  const [name, setName] = useState(session.draft.name ?? '');
  const [attempted, setAttempted] = useState(false);
  useEffect(() => { if (!session.draft.avatarId || !session.draft.countryId) router.replace('/new-game/country'); }, [session.draft.avatarId, session.draft.countryId]);
  const message = attempted ? validateCharacterName(name) : null;
  const avatar = session.options?.avatars.find((item) => item.id === session.draft.avatarId);
  return <Screen><Heading title="What is your name?" subtitle="Choose the name people in town will use for you." />
    {avatar ? <AvatarPreview large color={avatar.outfitColor} /> : null}
    <form className="form-stack flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); setAttempted(true); if (validateCharacterName(name)) return; session.updateDraft({ name }); router.push('/new-game/review'); }}>
      <label>Character name<input aria-describedby="name-help" aria-invalid={Boolean(message)} value={name} onChange={(event) => { setName(event.target.value); session.updateDraft({ name: event.target.value }); }} onBlur={() => setAttempted(true)} autoCapitalize="words" maxLength={2000} placeholder="Enter a name" /></label>
      <p id="name-help" role={message ? 'alert' : undefined} className={message ? "error text-[#a43f34] text-[15px] leading-[1.4]" : "hint text-muted text-[13px] leading-[1.4]"}>{message ?? 'Your name can use any language.'}</p>
      <button type="submit" className="action-button min-h-[54px] text-white text-[17px] font-extrabold [border:2px_solid_transparent] rounded-[16px] [padding:12px_24px] bg-green [&.secondary]:bg-transparent [&.secondary]:border-border [&.secondary]:text-ink">Review my choices</button>
    </form>
    <ActionButton label="Back" secondary onClick={() => router.replace('/new-game/avatar')} />
  </Screen>;
}
