import type { ArrivalGoal, GoalNotice, QuestBoardState } from '../types/gameplay/goals';

export const mockArrivalGoals: ArrivalGoal[] = [
  { id: 'tutorial', title: 'Learn to explore', status: 'complete' },
  { id: 'receptionist', title: 'Ask the receptionist for directions', status: 'current', npcId: 'npc_station_information' },
  { id: 'ticket', title: 'Get a bus ticket', status: 'upcoming' },
  { id: 'id-card', title: 'Get an ID card at the tax office', status: 'locked' },
];

export function goalNotice(goals: readonly ArrivalGoal[] = mockArrivalGoals): GoalNotice {
  return { active: goals.filter((goal) => goal.status === 'current').length, fresh: goals.filter((goal) => goal.status === 'new').length };
}
export function npcNeedsTalk(npcId: string, goals: readonly ArrivalGoal[] = mockArrivalGoals): boolean {
  return goals.some((goal) => goal.npcId === npcId && (goal.status === 'current' || goal.status === 'new'));
}

export function shouldShowQuestBoard({ tutorialOpen, mapReady }: QuestBoardState): boolean {
  return mapReady && !tutorialOpen;
}
