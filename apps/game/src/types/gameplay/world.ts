import type { Appearance } from '@life-abroad/shared';
export interface Point {
  x: number;
  y: number;
}
export interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
export interface StationNpc extends Point {
  id: string;
  name: string;
  texture: string;
}
export interface StationPortal extends Point {
  id: string;
  label: string;
}
export type Direction = 'left' | 'right' | 'up' | 'down';
export type MapLocation = 'station' | 'cafe' | 'corner_cafe' | 'clothes' | 'street';
export type StoreLocation = Extract<MapLocation, 'cafe' | 'corner_cafe' | 'clothes'>;
export interface NpcTalkPrompt extends Point {
  npcId: string;
  name: string;
}
export interface StationCallbacks {
  appearance?: Appearance | undefined;
  practice?: boolean;
  onProgress: (value: number) => void;
  initialLocation?: 'station' | 'street';
  onEnterStreet?: () => Promise<boolean>;
  onNearby: (id: string | null) => void;
  onTalkPrompt?: (prompt: NpcTalkPrompt | null) => void;
  onTalk: (id: string) => void;
  onReady: () => void;
  onLocationChange: (location: string) => void;
  onError: (message: string) => void;
  getGameTime?: () => Date | null;
  onStoreClosed?: (location: StoreLocation) => void;
  onExitBlocked: () => void;
}
export interface StationGame {
  setAppearance: (appearance: Appearance | undefined) => void;
  destroy: () => void;
  pause: (paused: boolean, worldPaused?: boolean, conversationNpcId?: string | null) => void;
  unlockExit: (unlocked: boolean) => void;
  talk: () => void;
}
export interface GameCanvasProps {
  appearance?: Appearance | undefined;
  initialLocation?: 'station' | 'street';
  onEnterStreet?: () => Promise<boolean>;
  paused: boolean;
  worldPaused?: boolean;
  conversationNpcId?: string | null;
  exitUnlocked: boolean;
  onExitBlocked: () => void;
  onTalk: (id: string) => void;
  onReadyChange: (ready: boolean) => void;
  onLocationChange: (location: string) => void;
  getGameTime?: () => Date | null;
  onStoreClosed?: (location: StoreLocation) => void;
}
