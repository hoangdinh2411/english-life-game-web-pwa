import { z } from 'zod';

export const movementTutorialPages = [
  { id: 'move', title: 'Move Around', description: 'Use WASD or the arrow keys on a keyboard. On a phone or tablet, use the touch control.' },
  { id: 'interact', title: 'Talk and Interact', description: 'Walk close to people, counters, or entrances. Use the interaction prompt to talk or enter.' },
  { id: 'goals', title: 'Follow Your Goals', description: 'Open Goals when you need your next step. An exclamation mark means a quest or important action is nearby.' },
  { id: 'practice', title: 'Practice English', description: 'Speak or type your replies during conversations. NPCs naturally recast useful corrections, and English Review will collect material you choose to save.' },
  { id: 'menu', title: 'Use the Game Menu', description: 'Open the Game Menu for Settings or to replay this tutorial. Return to the same live world whenever you are ready.' },
] as const;

export const movementTutorialPageIdSchema = z.enum(movementTutorialPages.map(page => page.id));
export type MovementTutorialPageId = z.infer<typeof movementTutorialPageIdSchema>;

export const tutorialSpeechResponseSchema = z.object({ url: z.string().url() }).strict();
export type TutorialSpeechResponse = z.infer<typeof tutorialSpeechResponseSchema>;

export function movementTutorialNarration(pageId: MovementTutorialPageId): string {
  const page = movementTutorialPages.find(candidate => candidate.id === pageId);
  if (!page) throw new Error('Unknown movement tutorial page.');
  return `${page.title}. ${page.description}`;
}
