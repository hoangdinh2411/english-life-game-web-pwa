import type { OnboardingDraft } from '../types/onboarding';

export function validateCharacterName(name: string): string | null {
  if (!name.trim()) return 'Please enter a name.';
  if (name.length > 2000) return 'Name is too long.';
  return null;
}

export function mergeOnboardingDraft(current: Partial<OnboardingDraft>, changes: Partial<OnboardingDraft>): Partial<OnboardingDraft> {
  return { ...current, ...changes };
}

export function canReview(draft: Partial<OnboardingDraft>): draft is OnboardingDraft {
  return typeof draft.countryId === 'string' && draft.countryId.length > 0
    && typeof draft.avatarId === 'string' && draft.avatarId.length > 0
    && typeof draft.name === 'string' && validateCharacterName(draft.name) === null;
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
