import type { ArrivalState } from '@life-abroad/shared';
import { arrivalPresentation } from './arrival-presentation';

export function TicketReceipt({ arrival }: { arrival: ArrivalState }) {
  const view = arrivalPresentation(arrival);
  return <div className="arrival-ticket" role="status"><strong>{view.ticket}</strong>
    <span>{arrival.ticket.used ? 'Maplewood Town Street · Journey completed' : arrival.ticket.issued ? 'Maplewood Town Street · Ready for the station exit' : 'Ask the receptionist after saying hello.'}</span>
  </div>;
}
export function ArrivalQuest({ arrival }: { arrival: ArrivalState }) {
  const view = arrivalPresentation(arrival);
  return <section className="quest-board arrival-quest" aria-label="Saved arrival progress">
    <h3>{view.title}</h3><p>{`${view.completed} of ${view.total} steps complete`}</p>
    <ol>{view.steps.map((step) => <li key={step.id} className={step.status} aria-current={step.status === 'current' ? 'step' : undefined}>
      <span aria-label={step.status}>{step.status === 'complete' ? '✓' : step.status === 'current' ? '›' : '○'}</span><span>{step.title}</span>
    </li>)}</ol>
    <TicketReceipt arrival={arrival} />
    <p className="hint">{view.next}</p>
    {arrival.rewardsGranted ? <p role="status">Rewards saved · Granted once for this arrival.</p> : null}
  </section>;
}
