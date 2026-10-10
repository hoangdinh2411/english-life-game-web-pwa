import type { QuestBoardProps } from '../types/ui/gameplay';
import type { ArrivalGoal } from '../types/gameplay/goals';
import { mockArrivalGoals } from './arrival-hud';
const STATUS_MARKS: Record<ArrivalGoal['status'], string> = { complete: '✓', current: '›', new: '!', upcoming: '○', locked: '·' };
export function QuestBoard({ inPanel = false }: QuestBoardProps) {
  return <section aria-label="Arrival goals preview" className={inPanel ? 'quest-board' : 'quest-board floating'}>
    <h3>Your first day</h3><p className="hint">Preview goals</p>
    <ul>{mockArrivalGoals.map((goal) => <li key={goal.id} className={goal.status}>
      <span aria-label={goal.status}>{STATUS_MARKS[goal.status]}</span>
      <span>{goal.status === 'new' ? 'New · ' : goal.status === 'current' ? 'Active · ' : ''}{goal.title}</span>
    </li>)}</ul>
  </section>;
}
