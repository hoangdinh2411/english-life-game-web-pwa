export interface TutorialPage {
  title: string;
  description: string;
  illustrationAlt: string;
}

export const tutorialPages = [
  {
    title: 'Move Around',
    description: 'Use WASD or the arrow keys on a keyboard. On a phone or tablet, use the touch control.',
    illustrationAlt: 'A traveler walking with keyboard arrows and a touch control.',
  },
  {
    title: 'Talk and Interact',
    description: 'Walk close to people, counters, or entrances. Use the interaction prompt to talk or enter.',
    illustrationAlt: 'A traveler talking with a friendly person at a counter.',
  },
  {
    title: 'Follow Your Goals',
    description: 'Open Goals when you need your next step. An exclamation mark means a quest or important action is nearby.',
    illustrationAlt: 'A traveler checking the next step in a goal journal.',
  },
  {
    title: 'Practice English',
    description: 'Speak or type your replies during conversations. Turn on Coach for corrections and revisit useful material in English Review.',
    illustrationAlt: 'A traveler practicing a conversation with speech bubbles and a microphone.',
  },
  {
    title: 'Use the Game Menu',
    description: 'Open the Game Menu for Settings or to replay this tutorial. Return to the same live world whenever you are ready.',
    illustrationAlt: 'A traveler opening game settings and a tutorial card.',
  },
] as const satisfies readonly TutorialPage[];
