import { movementTutorialPages } from '@life-abroad/shared';

export interface TutorialPage {
  id: (typeof movementTutorialPages)[number]['id'];
  title: string;
  description: string;
  illustrationAlt: string;
}

const illustrationAlts = [
  'A traveler walking with keyboard arrows and a touch control.',
  'A traveler talking with a friendly person at a counter.',
  'A traveler checking the next step in a goal journal.',
  'A traveler practicing a conversation with speech bubbles and a microphone.',
  'A traveler opening game settings and a tutorial card.',
] as const;

export const tutorialPages = movementTutorialPages.map((page, index) => ({
  ...page,
  illustrationAlt: illustrationAlts[index]!,
})) satisfies readonly TutorialPage[];

export function tutorialNarrationText(
  page: TutorialPage,
): string {
  return `${page.title}. ${page.description}`;
}
