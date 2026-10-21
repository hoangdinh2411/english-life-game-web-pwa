import { useEffect, useState } from 'react';
import { router } from '../../navigation/router';
import { ActionButton, ChoiceCard, Heading, Screen } from '../../components/onboarding-ui';
import { useSession } from '../../session/session-provider';
export default function CityScreen() {
  const session = useSession();
  const [message, setMessage] = useState('');
  useEffect(() => { if (!session.options) void session.refreshOptions().catch(() => setMessage('Could not load countries. Check your connection and try again.')); }, [session.options, session.refreshOptions]);
  return <Screen><Heading title="Choose your country" subtitle="Where would you like your new story to begin?" />
    {session.options?.countries.map((country) => <ChoiceCard key={country.id} title={country.name} subtitle={`${country.isoCode} · ${country.timeZone}`} selected={session.draft.countryId === country.id} onClick={() => session.updateDraft({ countryId: country.id })}><span className="city-preview w-18 h-18 shrink-0 rounded-[16px] bg-[#e5eddd] grid place-items-center text-[32px]" aria-hidden="true">{country.flag}</span></ChoiceCard>)}
    {message ? <p role="alert" className="error text-[#a43f34] text-[15px] leading-[1.4]">{message}</p> : null}
    {!session.options && !message ? <p role="status">Loading countries…</p> : null}
    <ActionButton label="Continue" disabled={!session.options?.countries.some((country) => country.id === session.draft.countryId)} onClick={() => router.push('/new-game/avatar')} />
    <ActionButton label="Back" secondary onClick={() => router.replace('/new-game')} />
    {message ? <ActionButton label="Try again" secondary onClick={() => { setMessage(''); void session.refreshOptions().catch(() => setMessage('Could not load countries. Check your connection and try again.')); }} /> : null}
  </Screen>;
}
