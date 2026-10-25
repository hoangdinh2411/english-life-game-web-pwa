export interface TutorialPage {
  title: string;
  description: string;
}

export const tutorialPages = [
  {
    title: 'Move Around',
    description: 'Use WASD or the arrow keys on a keyboard. On a phone or tablet, use the touch control.',
  },
  {
    title: 'Talk and Interact',
    description: 'Walk close to people, counters, or entrances. Use the interaction prompt to talk or enter.',
  },
  {
    title: 'Follow Your Goals',
    description: 'Open Goals when you need your next step. An exclamation mark means a quest or important action is nearby.',
  },
  {
    title: 'Practice English',
    description: 'Speak or type your replies during conversations. Turn on Coach for corrections and revisit useful material in English Review.',
  },
  {
    title: 'Use the Game Menu',
    description: 'Open the Game Menu for Settings or to replay this tutorial. Return to the same live world whenever you are ready.',
  },
] as const satisfies readonly TutorialPage[];
