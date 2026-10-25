import { DialogueFrame } from "../../gameplay/DialogueFrame";
import { GameButton } from "../../gameplay/GameButton";
import { Settings } from "../hud/Settings";

interface SettingsPanelProps {
  practice: boolean;
  onBack: () => void;
}

export function SettingsPanel({ practice, onBack }: SettingsPanelProps) {
  return (
    <DialogueFrame ariaLabel="Settings" onClose={onBack}>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[18px] font-extrabold">Settings</h2>
          <GameButton label="Back to Game Menu" onClick={onBack} />
        </div>
        <p className="text-sm text-muted">{practice
          ? 'These settings apply only to this local practice session. Sound remains saved on this device.'
          : 'Sound stays on this device. Coach and voice settings follow your account.'}</p>
        <Settings practice={practice} />
      </div>
    </DialogueFrame>
  );
}
