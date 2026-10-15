import { useEffect, useState } from 'react';
import { reviewSchema, type LearningReview } from '@life-abroad/shared';
import { request } from '../../api/client';
import { useSession } from '../../session/session-provider';
import { DialogueFrame } from '../../gameplay/DialogueFrame';
import { GameButton } from '../../gameplay/GameButton';

export function ReviewDialogue({ onClose }: { onClose: () => void }) {
  const { runAuthenticated } = useSession();
  const [review, setReview] = useState<LearningReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void runAuthenticated(async token => reviewSchema.parse(await request('learning/review', undefined, token)))
      .then(value => { if (active) setReview(value); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Your review could not load.'); });
    return () => { active = false; };
  }, [runAuthenticated, attempt]);
  return <DialogueFrame ariaLabel="English review">
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-lg font-extrabold">English review</h2>
      <GameButton label="Close review" onClick={onClose} />
    </div>
    {!review && !error ? <p role="status">Loading your saved learning…</p> : null}
    {error ? <><p role="alert">{error}</p><GameButton label="Try again" onClick={() => { setError(null); setAttempt(value => value + 1); }} /></> : null}
    {review ? <div className="flex flex-col gap-4 [overflow-wrap:anywhere]">
      <section aria-label="Useful shop phrases" className="flex flex-col gap-2">
        <h3 className="font-bold">Useful shop phrases</h3>
        {review.phrases.length ? <ul className="flex flex-col gap-2">{review.phrases.map(entry =>
          <li key={entry.phrase} className="rounded-xl bg-card p-3"><strong>{entry.phrase}</strong><p>{entry.example}</p></li>)}</ul>
          : <p>Ask a seller about a price or order with “I'd like…” to save a useful phrase here.</p>}
      </section>
      <section aria-label="Past corrections" className="flex flex-col gap-2">
        <h3 className="font-bold">Past corrections</h3>
        {review.corrections.length ? <ul className="flex flex-col gap-2">{review.corrections.map(entry =>
          <li key={entry.id} className="rounded-xl bg-[#e5eddf] p-3">
            <p><span className="font-bold">You said: </span>{entry.feedback.original}</p>
            <p><span className="font-bold">Try: </span>{entry.feedback.improved}</p>
            <p className="text-sm text-muted">{entry.feedback.reason}</p>
          </li>)}</ul> : <p>Turn Coach on during a conversation to save corrections when a phrase needs help.</p>}
      </section>
    </div> : null}
  </DialogueFrame>;
}
