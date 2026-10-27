import type { PlayerLocation, StationSpeaker } from "@life-abroad/shared";
import type { ReactNode } from "react";
import type { ArrivalGoal } from "../gameplay/goals";
import type { LifeControls } from "../../features/life/useLife";
export interface ComposerIconProps {
  kind: "microphone" | "send" | "stop";
  color: string;
}
export interface ComposerActionProps {
  label: string;
  kind: "microphone" | "send" | "stop";
  disabled: boolean;
  onClick: () => void;
}
export interface GameButtonProps {
  label: string;
  ariaLabel?: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}
export interface OverlayButtonProps {
  label: string;
  icon: ReactNode;
  onClick: () => void;
}
export interface PlayerInfoCardProps {
  gender?: import("@life-abroad/shared").PlayerGender | undefined;
  playerName: string;
  cityName: string;
  coins: number;
  visible?: boolean;

  onOpenProfile: () => void;
}
export interface DialogueMessageProps {
  portraitPosition?: string | undefined;
  portraitGrid?: { columns: number; rows: number } | undefined;
  name: string;
  portrait: string;
  text: string;
  fullText?: string;
  revealing?: boolean;
  player?: boolean;
  thinking?: boolean;
  onReplay?: () => void;
  replayVisible?: boolean;
  replayDisabled?: boolean;
}
export interface ConversationPanelProps {
  gender?: import("@life-abroad/shared").PlayerGender | undefined;
  npcId: StationSpeaker;
  playerName: string;
  sound: boolean;
  onClose: () => void;
  onDirections?: (received: boolean) => void;
}
export interface QuestBoardProps {
  inPanel?: boolean;
  goals?: readonly ArrivalGoal[];
}
export interface StationScreenProps {
  gender?: import("@life-abroad/shared").PlayerGender | undefined;
  life?: LifeControls;
  arrival?: {
    initialLocation: PlayerLocation;
    exitUnlocked: boolean;
    pending: boolean;
    farewellConfirm: boolean;
    error: string;
    online: boolean;
    goalsLabel: string;
    questPanel: ReactNode;
    statusPanel: ReactNode;
    blockedExitMessage: string;
    onRetry: () => void;
    onOpenReceptionist: () => void;
    onEnterStreet: () => Promise<boolean>;
    onPlaceChange: (location: PlayerLocation) => void;
    renderReceptionist: (sound: boolean, onClose: () => void) => ReactNode;
  };
  playerName: string;
  countryName?: string | undefined;
  xp: number;
  coins: number;
  onSignOut: () => void;
  practice?: boolean;
}
export interface MessageComposerProps {
  text: string;
  onChange: (text: string) => void;
  onSend: () => void;
  onRecord: () => void;
  onCancelRecording: () => void;
  voiceSupported: boolean;
  listening: boolean;
  pending: boolean;
}
export interface PwaStatusProps {
  playing: boolean;
}
