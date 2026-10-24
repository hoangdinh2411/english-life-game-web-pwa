import type { CreateCharacterRequest } from '@life-abroad/shared';
export type OnboardingDraft = CreateCharacterRequest;
export type OnboardingDraftChanges = { [Key in keyof OnboardingDraft]?: OnboardingDraft[Key] | undefined };
