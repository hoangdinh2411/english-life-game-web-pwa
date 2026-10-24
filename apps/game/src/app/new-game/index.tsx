import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { CountryOption, PlayerGender } from '@life-abroad/shared';
import { Heading, Screen } from '../../components/onboarding-ui';
import { playerAssets } from '../../features/appearance/player-assets';
import { resolveCountryFlag } from '../../onboarding/country-flags';
import { canSubmitOnboarding, filterCountries, reconcileCountrySelection, StartLifeSubmission, validateCharacterName } from '../../onboarding/onboarding-state';
import { router } from '../../navigation/router';
import { useSession } from '../../session/session-provider';
import type { OnboardingDraft } from '../../types/onboarding';

interface OnboardingFormProps {
  countries: CountryOption[] | null;
  loadError: string;
  onRetry: () => Promise<void>;
  onComplete: (draft: OnboardingDraft) => Promise<void>;
}

export function OnboardingForm({ countries: availableCountries, loadError, onRetry, onComplete }: OnboardingFormProps) {
  const listId = useId();
  const lock = useRef(new StartLifeSubmission());
  const optionRefs = useRef(new Map<string, HTMLButtonElement>());
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState<PlayerGender | null>(null);
  const [step, setStep] = useState<'country' | 'character' | 'name'>('country');
  const [selected, setSelected] = useState<CountryOption | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [touchedName, setTouchedName] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const countries = useMemo(() => filterCountries(availableCountries ?? [], query), [query, availableCountries]);
  const nameError = touchedName ? validateCharacterName(name) : null;
  const draft = selected && gender ? { countryId: selected.id, gender, name } : { name };
  const valid = canSubmitOnboarding(draft);
  useEffect(() => {
    const active = countries[activeIndex];
    if (active) optionRefs.current.get(active.id)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, countries]);

  function updateQuery(value: string) {
    setQuery(value);
    const nextSelection = reconcileCountrySelection(value, selected);
    setSelected(nextSelection);
    setActiveIndex(-1);
  }

  function chooseCountry(country: CountryOption) {
    setSelected(country);
    setQuery(country.name);
    setActiveIndex(-1);
  }

  function handleCountryKeys(event: KeyboardEvent<HTMLInputElement>) {
    if (!countries.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex(current => current < 0 ? (direction > 0 ? 0 : countries.length - 1) : (current + direction + countries.length) % countries.length);
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      const country = countries[activeIndex];
      if (country) chooseCountry(country);
    } else if (event.key === 'Escape') setActiveIndex(-1);
  }

  async function submit() {
    setTouchedName(true);
    if (!valid || busy || !selected || !gender) return;
    setBusy(true);
    setMessage('');
    try {
      await lock.current.run(() => onComplete({ countryId: selected.id, gender, name }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not start your life. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const stepNumber = step === 'country' ? 1 : step === 'character' ? 2 : 3;
  const heading = step === 'country'
    ? { title: 'Where will you live?', subtitle: 'Choose the country where your story begins.' }
    : step === 'character'
      ? { title: 'Choose your character', subtitle: 'Pick the character you want to play.' }
      : { title: 'What is your name?', subtitle: 'Choose the name people will use in your new life.' };

  return <Screen>
    <p className="text-sm font-bold text-green" aria-live="polite">Step {stepNumber} of 3</p>
    <Heading title={heading.title} subtitle={heading.subtitle} />
    <form className="flex min-h-0 flex-col gap-4 [@media(max-width:479px)]:gap-3" onSubmit={event => { event.preventDefault(); if (step === 'name') void submit(); }}>
      {step === 'country' ? <section className="flex min-h-0 flex-col gap-2" aria-labelledby="country-label">
        <label id="country-label" htmlFor="country-search" className="font-extrabold text-ink">Country</label>
        <input id="country-search" type="search" role="combobox" autoComplete="off" value={query}
          aria-autocomplete="list" aria-controls={listId} aria-expanded={countries.length > 0}
          aria-activedescendant={activeIndex >= 0 ? `${listId}-${countries[activeIndex]?.id}` : undefined}
          placeholder="Search by country or code" onChange={event => updateQuery(event.target.value)} onKeyDown={handleCountryKeys} />
        <p className="text-sm text-muted">Search, then select one country.</p>
        {availableCountries ? <div id={listId} role="listbox" aria-label="Countries" className="max-h-[clamp(192px,31dvh,288px)] overflow-y-auto rounded-2xl border-2 border-border bg-card p-1">
          {countries.length ? countries.map((country, index) => <button id={`${listId}-${country.id}`} key={country.id} type="button" role="option"
            ref={element => { if (element) optionRefs.current.set(country.id, element); else optionRefs.current.delete(country.id); }}
            aria-selected={selected?.id === country.id} onClick={() => chooseCountry(country)}
            className={`flex min-h-12 w-full items-center gap-2.5 rounded-xl px-3 py-1.5 text-left text-ink hover:bg-[#edf3e9] focus-visible:outline-4 focus-visible:outline-offset-[-4px] focus-visible:outline-green ${activeIndex === index ? 'bg-[#edf3e9]' : ''} ${selected?.id === country.id ? 'bg-[#e5eddd] font-extrabold' : ''}`}>
            {resolveCountryFlag(country.isoCode) ? <img src={resolveCountryFlag(country.isoCode)} alt="" className="h-6 w-9 shrink-0 rounded object-cover shadow-sm" /> : <span aria-hidden="true" className="w-9 text-center text-xl">{country.flag}</span>}
            <span className="min-w-0 flex-1"><span className="block truncate">{country.name}</span><span className="text-sm font-normal text-muted">{country.isoCode}</span></span>
            {selected?.id === country.id ? <span aria-hidden="true" className="text-green">✓</span> : null}
          </button>) : <p className="p-4 text-center text-muted" role="status">No countries match “{query}”.</p>}
        </div> : null}
        {!availableCountries && !loadError ? <p role="status">Loading countries…</p> : null}
      </section> : null}

      {step === 'character' ? <section className="grid grid-cols-2 gap-3" aria-label="Characters">
        {(['female', 'male'] as const).map((option, index) => {
          const assets = playerAssets(option);
          const selectedOption = gender === option;
          return <button key={option} type="button" aria-label={`Choose character ${index + 1}`} aria-pressed={selectedOption}
            onClick={() => setGender(option)}
            className={`relative flex min-h-[180px] items-center justify-center overflow-hidden rounded-2xl border-2 bg-card p-3 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-green ${selectedOption ? 'border-green bg-[#e5eddd]' : 'border-border'}`}>
            <span className="relative block aspect-square w-full max-w-[140px] overflow-hidden" aria-hidden="true">
              <span className="absolute inset-0 scale-[1.55] bg-contain bg-left bg-no-repeat"
                style={{ backgroundImage: `url(${assets.portrait})`, backgroundSize: `${assets.portraitColumns * 100}% 100%` }} />
            </span>
            {selectedOption ? <span className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-green font-extrabold text-white" aria-hidden="true">✓</span> : null}
          </button>;
        })}
      </section> : null}

      {step === 'name' ? <section className="flex flex-col gap-2" aria-labelledby="name-label">
        <label id="name-label" htmlFor="character-name" className="font-extrabold text-ink">Your name</label>
        <input id="character-name" value={name} autoCapitalize="words" autoComplete="name" maxLength={20}
          aria-describedby="name-help" aria-invalid={Boolean(nameError)} placeholder="Enter your name"
          onChange={event => setName(event.target.value)} onBlur={() => setTouchedName(true)} />
        <p id="name-help" role={nameError ? 'alert' : undefined} className={`text-sm ${nameError ? 'text-[#a43f34]' : 'text-muted'}`}>
          {nameError ?? 'Use 2–20 letters. Spaces, apostrophes, and hyphens are welcome.'}
        </p>
      </section> : null}

      {message || loadError ? <div className="flex flex-col gap-2" role="alert"><p className="text-sm text-[#a43f34]">{message || loadError}</p>
        {!availableCountries ? <button type="button" className="min-h-11 self-start rounded-xl border-2 border-border bg-card px-4 font-bold" onClick={() => void onRetry()}>Try again</button> : null}
      </div> : null}
      <div className="grid grid-cols-2 gap-3">
        {step !== 'country' ? <button type="button" disabled={busy} onClick={() => setStep(step === 'name' ? 'character' : 'country')}
          className="min-h-[54px] rounded-2xl border-2 border-border bg-card px-5 text-[17px] font-extrabold text-ink focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-green">Back</button> : <span />}
        {step === 'country' ? <button type="button" disabled={!selected} onClick={() => setStep('character')}
          className="min-h-[54px] rounded-2xl border-2 border-transparent bg-green px-5 text-[17px] font-extrabold text-white focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50">Continue</button>
          : step === 'character' ? <button type="button" disabled={!gender} onClick={() => setStep('name')}
            className="min-h-[54px] rounded-2xl border-2 border-transparent bg-green px-5 text-[17px] font-extrabold text-white focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50">Continue</button>
            : <button type="submit" disabled={!valid || busy} className="min-h-[54px] rounded-2xl border-2 border-transparent bg-green px-5 text-[17px] font-extrabold text-white focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50">
              {busy ? 'Starting your life…' : 'Start my life'}
            </button>}
      </div>
    </form>
  </Screen>;
}

export default function NewGameScreen() {
  const session = useSession();
  const [loadError, setLoadError] = useState('');
  const load = useCallback(async () => {
    setLoadError('');
    await session.refreshOptions().catch(() => setLoadError('Could not load countries. Check your connection and try again.'));
  }, [session.refreshOptions]);
  useEffect(() => { if (!session.options) void load(); }, [load, session.options]);
  return <OnboardingForm countries={session.options?.countries ?? null} loadError={loadError} onRetry={load}
    onComplete={async draft => { session.updateDraft(draft); await session.startLife(draft); router.replace('/home'); }} />;
}
