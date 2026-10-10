export type ArrivalGoalStatus = 'complete' | 'current' | 'new' | 'upcoming' | 'locked';
export interface ArrivalGoal {
  id: string;
  title: string;
  status: ArrivalGoalStatus;
  npcId?: string;
}
export interface GoalNotice {
  active: number;
  fresh: number;
}
export interface QuestBoardState {
  tutorialOpen: boolean;
  mapReady: boolean;
}
