import type { QuestBoardProps } from '../types/ui/gameplay';
import type { ArrivalGoal } from '../types/gameplay/goals';
import { mockArrivalGoals } from './arrival-hud';
const STATUS_MARKS: Record<ArrivalGoal['status'], string> = { complete: '✓', current: '›', new: '!', upcoming: '○', locked: '·' };
export function QuestBoard({ inPanel = false, goals = mockArrivalGoals }: QuestBoardProps) {
  return <section aria-label="Arrival goals preview" className={`quest-board max-h-[280px] bg-[rgba(255,_248,_233,_0.94)] [border:1px_solid_#aa8b57] rounded-[14px] [padding:11px] overflow-auto [&_h3]:text-[14px] [&_h3]:[margin-bottom:7px] [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:list-none [&_ul]:p-0 [&_li]:flex [&_li]:gap-2 [&_li]:text-[12px] [&_li]:leading-[1.4] [&_li_>_span:first-child]:w-4 [&_li_>_span:first-child]:shrink-0 [&_li_>_span:first-child]:text-[16px] [&_li_>_span:first-child]:[text-align:center] [&_.current]:font-bold [&_.new]:font-bold [&_.locked]:text-[#817a6d] [&.floating]:absolute [&.floating]:[top:146px] [&.floating]:left-3 [&.floating]:w-[min(280px,_calc(100%_-_24px))] ${inPanel ? "" : "floating"}`}>
    <h3>Your first day</h3><p className="hint text-muted text-[13px] leading-[1.4]">Preview goals</p>
    <ul>{goals.map((goal) => <li key={goal.id} className={goal.status}>
      <span aria-label={goal.status}>{STATUS_MARKS[goal.status]}</span>
      <span>{goal.status === 'new' ? 'New · ' : goal.status === 'current' ? 'Active · ' : ''}{goal.title}</span>
    </li>)}</ul>
  </section>;
}
