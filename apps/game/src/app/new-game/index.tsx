import { useRef, useState } from 'react';
import type { CountryOption, PassportDraft, PlayerGender, UserMode } from '@life-abroad/shared';
import { Screen } from '../../components/onboarding-ui';
import { playerAssets } from '../../features/appearance/player-assets';
import { StartLifeSubmission, validateCharacterName } from '../../onboarding/onboarding-state';
import { router } from '../../navigation/router';
import { useSession } from '../../session/session-provider';
import { GameIcon } from '../../shared/GameIcon';
import { preferences } from '../../features/hud/usePreferences';

export interface OnboardingFormProps {
  onComplete?: (draft: PassportDraft, mode: UserMode) => Promise<void>;
  countries?: CountryOption[] | null;
  loadError?: string;
  onRetry?: () => Promise<void>;
}

export function OnboardingForm({ onComplete, loadError }: OnboardingFormProps) {
  const lock = useRef(new StartLifeSubmission());
  const [name, setName] = useState('');
  const [gender, setGender] = useState<PlayerGender | null>(null);
  const [touchedName, setTouchedName] = useState(false);
  const [mode, setMode] = useState<UserMode>('adult');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const nameError = touchedName ? validateCharacterName(name) : null;
  const isNameValid = !validateCharacterName(name);
  const canSubmit = Boolean(gender) && isNameValid && !busy;

  async function submit() {
    setTouchedName(true);
    if (!gender || !isNameValid || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const avatarId = gender === 'female' ? 'avatar_traveler_01' : 'avatar_traveler_02';
      await lock.current.run(async () => {
        if (onComplete) {
          await onComplete({ name: name.trim(), gender, avatarId }, mode);
        }
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not issue passport. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <div className="flex flex-col gap-5">
        <div className="relative overflow-hidden rounded-3xl border-2 border-[var(--color-gold-border)] bg-card shadow-lg">
          <div className="flex items-center justify-between border-b-2 border-[var(--color-gold-border)] bg-[var(--color-dialogue)] px-6 py-4">
            <div className="flex items-center gap-2.5">
              <span className="text-xl" aria-hidden="true">🛂</span>
              <div>
                <span className="block text-xs font-black uppercase tracking-widest text-[var(--color-gold-border)]">
                  Official Travel Document
                </span>
                <span className="block text-lg font-black tracking-wide text-ink">
                  INTERNATIONAL PASSPORT
                </span>
              </div>
            </div>
            <span className="rounded-full border border-[var(--color-gold-border)] bg-[var(--color-gold)] px-2.5 py-0.5 text-xs font-extrabold text-ink">
              DEPARTURE
            </span>
          </div>

          <form
            className="flex flex-col gap-6 p-6"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <section className="flex flex-col gap-2" aria-labelledby="photo-label">
              <label id="photo-label" className="text-sm font-extrabold uppercase tracking-wider text-muted">
                1. Passport Photo (Select Character)
              </label>
              <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Character photo">
                {(['female', 'male'] as const).map((option, index) => {
                  const assets = playerAssets(option);
                  const selectedOption = gender === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={selectedOption}
                      aria-label={`Character ${index + 1} (${option})`}
                      onClick={() => setGender(option)}
                      className={`relative flex min-h-[160px] flex-col items-center justify-center overflow-hidden rounded-2xl border-2 p-3 transition-all focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-green ${
                        selectedOption
                          ? 'border-[var(--color-green-strong)] bg-[var(--color-success-surface)] shadow-sm'
                          : 'border-border bg-card hover:bg-[var(--color-success-soft)]'
                      }`}
                    >
                      <span className="relative block aspect-square w-full max-w-[120px] overflow-hidden rounded-lg bg-[var(--color-portrait)]" aria-hidden="true">
                        <span
                          className="absolute inset-0 scale-[1.55] bg-contain bg-left bg-no-repeat"
                          style={{
                            backgroundImage: `url(${assets.portrait})`,
                            backgroundSize: `${assets.portraitColumns * 100}% 100%`,
                          }}
                        />
                      </span>
                      <span className="mt-2 text-xs font-extrabold capitalize text-ink">
                        {option === 'female' ? 'Traveler A (Teal)' : 'Traveler B (Terracotta)'}
                      </span>
                      {selectedOption ? (
                        <span
                          className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-green text-white shadow"
                          aria-hidden="true"
                        >
                          <GameIcon name="check" className="size-4" />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="flex flex-col gap-2" aria-labelledby="name-label">
              <label id="name-label" htmlFor="passport-name" className="text-sm font-extrabold uppercase tracking-wider text-muted">
                2. Traveler Full Name / Nom
              </label>
              <input
                id="passport-name"
                value={name}
                autoCapitalize="words"
                autoComplete="name"
                maxLength={20}
                aria-describedby="name-help"
                aria-invalid={Boolean(nameError)}
                placeholder="Enter your name (e.g. Alex Rivera)"
                onChange={(event) => setName(event.target.value)}
                onBlur={() => setTouchedName(true)}
                className="w-full min-w-0 min-h-[54px] rounded-xl border-2 border-border bg-card px-4 text-[17px] font-normal text-ink focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-green"
              />
              <p
                id="name-help"
                role={nameError ? 'alert' : undefined}
                className={`text-xs font-semibold ${nameError ? 'text-[var(--color-danger)]' : 'text-muted'}`}
              >
                {nameError ?? '2–20 characters. Letters, spaces, apostrophes, and hyphens permitted.'}
              </p>
            </section>

            <section className="flex flex-col gap-2" aria-labelledby="mode-label">
              <label id="mode-label" className="text-sm font-extrabold uppercase tracking-wider text-muted">
                3. Travel Experience Mode
              </label>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Game Mode">
                <button
                  type="button"
                  role="radio"
                  aria-checked={mode === 'kid'}
                  onClick={() => setMode('kid')}
                  className={`flex min-h-12 items-center justify-center gap-1.5 rounded-xl border-2 px-3 text-sm font-extrabold transition-colors ${
                    mode === 'kid'
                      ? 'border-[var(--color-gold-border)] bg-[var(--color-gold)] text-ink shadow-xs'
                      : 'border-border bg-card text-muted hover:text-ink'
                  }`}
                >
                  <span>⭐ Kid Mode</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={mode === 'adult'}
                  onClick={() => setMode('adult')}
                  className={`flex min-h-12 items-center justify-center gap-1.5 rounded-xl border-2 px-3 text-sm font-extrabold transition-colors ${
                    mode === 'adult'
                      ? 'border-[var(--color-green-strong)] bg-[var(--color-success-surface-alt)] text-[var(--color-green-strong)] shadow-xs'
                      : 'border-border bg-card text-muted hover:text-ink'
                  }`}
                >
                  <span>💼 Adult Mode</span>
                </button>
              </div>
            </section>

            {message || loadError ? (
              <div className="rounded-xl border border-[var(--color-danger)] bg-[var(--color-dialogue)] p-3" role="alert">
                <p className="text-sm font-bold text-[var(--color-danger)]">{message || loadError}</p>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={!canSubmit}
              className="min-h-[54px] w-full rounded-2xl border-2 border-transparent bg-green px-6 text-[17px] font-extrabold text-white shadow-md transition-opacity hover:opacity-95 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Issuing Passport…' : 'Issue Passport & Depart'}
            </button>
          </form>
        </div>
      </div>
    </Screen>
  );
}

export default function NewGameScreen() {
  const session = useSession();

  return (
    <OnboardingForm
      onComplete={async (draft, mode) => {
        preferences.set('userMode', mode);
        await session.startPassportLife(draft);
        router.replace('/home');
      }}
    />
  );
}
