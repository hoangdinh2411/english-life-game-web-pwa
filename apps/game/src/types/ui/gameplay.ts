import type { StationSpeaker } from '@life-abroad/shared';
export interface ComposerIconProps {
  kind: 'microphone' | 'send' | 'stop';
  color: string;
}
export interface ComposerActionProps {
  label: string;
  kind: 'microphone' | 'send' | 'stop';
  disabled: boolean;
  onClick: () => void;
}
export interface GameButtonProps {
  label: string;
  ariaLabel?: string;
  onClick: () => void;
  disabled?: boolean;
}
export interface OverlayButtonProps {
  label: string;
  icon: string;
  onClick: () => void;
}
export interface PlayerInfoCardProps {
  playerName: string;
  cityName: string;
  xp: number;
  coins: number;
  visible?: boolean;
  timeZone?: string;
}
export interface DialogueMessageProps {
  name: string;
  portrait: string;
  text: string;
  player?: boolean;
  thinking?: boolean;
  onReplay?: () => void;
  replayDisabled?: boolean;
}
export interface ConversationPanelProps {
  npcId: StationSpeaker;
  playerName: string;
  sound: boolean;
  onClose: () => void;
  onDirections?: (received: boolean) => void;
}
export interface TutorialDialogueProps {
  playerName: string;
  sound: boolean;
  onClose: () => void;
}
export interface QuestBoardProps {
  inPanel?: boolean;
}
export interface StationScreenProps {
  playerName: string;
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
  voiceSupported: boolean;
  listening: boolean;
  pending: boolean;
}
export interface PwaStatusProps {
  playing: boolean;
}
