import type { CountryOption } from '@life-abroad/shared';
import type { OnboardingDraft, OnboardingDraftChanges } from '../types/onboarding';

export function validateCharacterName(name: string): string | null {
  if (!name.trim()) return 'Please enter a name.';
  const normalized = name.trim().normalize('NFC');
  if ([...normalized].length < 2 || [...normalized].length > 20 || !/^\p{L}[\p{L}\p{M}]*(?:[ '-]\p{L}[\p{L}\p{M}]*)*$/u.test(normalized)) {
    return 'Use 2–20 letters. Spaces, apostrophes, and hyphens are allowed.';
  }
  return null;
}

export function mergeOnboardingDraft(current: Partial<OnboardingDraft>, changes: OnboardingDraftChanges): Partial<OnboardingDraft> {
  const next = { ...current };
  if ('countryId' in changes) { if (changes.countryId === undefined) delete next.countryId; else next.countryId = changes.countryId; }
  if ('gender' in changes) { if (changes.gender === undefined) delete next.gender; else next.gender = changes.gender; }
  if ('name' in changes) { if (changes.name === undefined) delete next.name; else next.name = changes.name; }
  return next;
}

export function canSubmitOnboarding(draft: Partial<OnboardingDraft>): draft is OnboardingDraft {
  return typeof draft.countryId === 'string' && draft.countryId.length > 0
    && (draft.gender === 'female' || draft.gender === 'male')
    && typeof draft.name === 'string' && validateCharacterName(draft.name) === null;
}

export function filterCountries(countries: CountryOption[], query: string): CountryOption[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return countries;
  return countries.filter(country => country.name.toLocaleLowerCase().includes(normalized)
    || country.isoCode.toLocaleLowerCase().includes(normalized));
}

export function reconcileCountrySelection(query: string, selected: CountryOption | null): CountryOption | null {
  return selected && query.trim().toLocaleLowerCase() === selected.name.toLocaleLowerCase() ? selected : null;
}

export class StartLifeSubmission {
  submitting = false;

  async run<T>(create: () => Promise<T>): Promise<T | null> {
    if (this.submitting) return null;
    this.submitting = true;
    try { return await create(); }
    finally { this.submitting = false; }
  }
}
