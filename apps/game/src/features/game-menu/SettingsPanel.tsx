import { DialogueFrame } from "../../gameplay/DialogueFrame";
import { GameButton } from "../../gameplay/GameButton";
import { Settings } from "../hud/Settings";

interface SettingsPanelProps {
  practice: boolean;
  onClose: () => void;
}

export function SettingsPanel({ practice, onClose }: SettingsPanelProps) {
  return (
    <DialogueFrame ariaLabel="Settings" onClose={onClose}>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[18px] font-extrabold">Settings</h2>
          <GameButton label="Close Settings" onClick={onClose} />
        </div>
        {practice ? <p role="status" className="text-sm text-muted">Saved on this device for local practice.</p> : null}
        <Settings />
      </div>
    </DialogueFrame>
  );
}
