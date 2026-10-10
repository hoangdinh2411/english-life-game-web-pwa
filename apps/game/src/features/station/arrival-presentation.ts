import { ARRIVAL_QUEST_ID, questSchema, type ArrivalState } from '@life-abroad/shared';
import quests from '../../../../../content/seed/quests.json';

// Public authored labels describe the server's saved step; they never advance it.
const quest = questSchema.parse(quests.find((item) => item.id === ARRIVAL_QUEST_ID));
export function arrivalPresentation(arrival: ArrivalState) {
  const current = quest.steps.findIndex((step) => step.id === arrival.currentStepId);
  const completed = arrival.status === 'done' ? quest.steps.length : Math.max(0, current);
  const next = arrival.status === 'done' ? 'Arrival complete. Welcome to Town Street!' : quest.steps[current]?.description ?? 'Reconnect to check your next arrival step.';
  const ticket = arrival.ticket.used ? 'Bus ticket used' : arrival.ticket.issued ? 'Bus ticket received' : 'No bus ticket yet';
  return { title: quest.title, completed, total: quest.steps.length, next, ticket,
    steps: quest.steps.map((step, index) => ({ id: step.id, title: step.description,
      status: index < completed ? 'complete' : index === current ? 'current' : 'upcoming' })),
  };
}
