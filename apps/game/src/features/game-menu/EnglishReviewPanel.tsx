import { DialogueFrame } from '../../gameplay/DialogueFrame';
import { GameButton } from '../../gameplay/GameButton';

export function EnglishReviewPanel({ onClose }: { onClose: () => void }) {
  return (
    <DialogueFrame ariaLabel="English Review" onClose={onClose}>
      <h2 className="text-[18px] font-extrabold">English Review</h2>
      <p className="text-sm text-muted">
        Your saved words and corrections will appear here as you play.
      </p>
      <GameButton label="Back to Game Menu" onClick={onClose} />
    </DialogueFrame>
  );
}
