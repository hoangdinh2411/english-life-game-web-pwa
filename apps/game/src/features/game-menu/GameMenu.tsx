import { DialogueFrame } from "../../gameplay/DialogueFrame";
import { GameButton } from "../../gameplay/GameButton";

interface GameMenuProps {
  onOpenTutorial: () => void;
  onSignOut: () => void;
  onReturnToGame: () => void;
  onOpenSettings: () => void;
  onUpdate?: () => void;
}

export function GameMenu({
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
        <GameButton label="Movement Tutorial" onClick={onOpenTutorial} />
        <GameButton label="Sign Out" onClick={onSignOut} />
        <GameButton label="Return to the Game" onClick={onReturnToGame} />
        <GameButton label="Settings" onClick={onOpenSettings} />
        {onUpdate ? <GameButton label="Reload to Update" onClick={onUpdate} /> : null}
      </nav>
    </DialogueFrame>
  );
}
