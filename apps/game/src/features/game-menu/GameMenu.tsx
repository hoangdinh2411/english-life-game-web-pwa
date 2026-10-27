import { DialogueFrame } from "../../gameplay/DialogueFrame";
import { GameButton } from "../../gameplay/GameButton";
import { GameIcon } from "../../shared/GameIcon";

interface GameMenuProps {
  practice?: boolean;
  onOpenReview: () => void;
  onOpenTutorial: () => void;
  onSignOut: () => void;
  onReturnToGame: () => void;
  onOpenSettings: () => void;
  onUpdate?: () => void;
}

export function GameMenu({
  practice = false,
  onOpenReview,
  onOpenTutorial,
  onSignOut,
  onReturnToGame,
  onOpenSettings,
  onUpdate,
}: GameMenuProps) {
  return (
    <DialogueFrame ariaLabel="Game menu" onClose={onReturnToGame}>
      <h2 className="text-[18px] font-extrabold">Game Menu</h2>
      <nav aria-label="Game menu actions" className="grid gap-2 sm:grid-cols-2">
        {!practice ? <GameButton label="English Review" icon={<GameIcon name="book" />} onClick={onOpenReview} /> : null}
        <GameButton label="Movement Tutorial" icon={<GameIcon name="compass" />} onClick={onOpenTutorial} />
        <GameButton label={practice ? "Leave Local Practice" : "Sign Out"} icon={<GameIcon name="logout" />} onClick={onSignOut} />
        <GameButton label="Return to the Game" icon={<GameIcon name="play" />} onClick={onReturnToGame} />
        <GameButton label="Settings" icon={<GameIcon name="settings" />} onClick={onOpenSettings} />
        {onUpdate ? <GameButton label="Reload to Update" icon={<GameIcon name="refresh" />} onClick={onUpdate} /> : null}
      </nav>
    </DialogueFrame>
  );
}
