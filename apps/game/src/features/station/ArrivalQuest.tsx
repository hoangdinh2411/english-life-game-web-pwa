import type { ArrivalState } from '@life-abroad/shared';
import { arrivalPresentation } from './arrival-presentation';

export function TicketReceipt({ arrival }: { arrival: ArrivalState }) {
  const view = arrivalPresentation(arrival);
  return <div className="arrival-ticket flex flex-col gap-[3px] [padding:10px_12px] [border:1px_solid_#9baa7d] rounded-[12px] bg-[#e5eddf] text-[14px] leading-[1.4] [&_span]:text-[13px]" role="status"><strong>{view.ticket}</strong>
    <span>{arrival.ticket.used ? 'Maplewood Town Street · Journey completed' : arrival.ticket.issued ? 'Maplewood Town Street · Ready for the station exit' : 'Ask the receptionist after saying hello.'}</span>
  </div>;
}
export function ArrivalQuest({ arrival }: { arrival: ArrivalState }) {
  const view = arrivalPresentation(arrival);
  return <section className="quest-board bg-[rgba(255,_248,_233,_0.94)] [border:1px_solid_#aa8b57] rounded-[14px] [padding:11px] overflow-auto [&_h3]:text-[14px] [&_h3]:[margin-bottom:7px] [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:list-none [&_ul]:p-0 [&_li]:flex [&_li]:gap-2 [&_li]:leading-[1.4] [&_li_>_span:first-child]:w-4 [&_li_>_span:first-child]:shrink-0 [&_li_>_span:first-child]:text-[16px] [&_li_>_span:first-child]:[text-align:center] [&_.current]:font-bold [&_.new]:font-bold [&_.locked]:text-[#817a6d] [&.floating]:absolute [&.floating]:[top:146px] [&.floating]:left-3 [&.floating]:w-[min(280px,_calc(100%_-_24px))]  arrival-quest max-h-[none] [&_ol]:flex [&_ol]:flex-col [&_ol]:gap-2.5 [&_ol]:pl-0 [&_ol]:list-none [&_ol]:[margin:12px_0] [&_li]:text-[14px] [&_>_p]:mt-2" aria-label="Saved arrival progress">
    <h3>{view.title}</h3><p>{`${view.completed} of ${view.total} steps complete`}</p>
    <ol>{view.steps.map((step) => <li key={step.id} className={step.status} aria-current={step.status === 'current' ? 'step' : undefined}>
      <span aria-label={step.status}>{step.status === 'complete' ? '✓' : step.status === 'current' ? '›' : '○'}</span><span>{step.title}</span>
    </li>)}</ol>
    <TicketReceipt arrival={arrival} />
    <p className="hint text-muted text-[13px] leading-[1.4]">{view.next}</p>
    {arrival.rewardsGranted ? <p role="status">Rewards saved · Granted once for this arrival.</p> : null}
  </section>;
}
