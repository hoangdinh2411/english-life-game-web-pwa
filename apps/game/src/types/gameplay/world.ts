import type Phaser from 'phaser';
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
export type MapLocation = 'station' | 'cafe' | 'clothes' | 'street';
export interface StationCallbacks {
  onNearby: (id: string | null) => void;
  onTalk: (id: string) => void;
  onReady: () => void;
  onLocationChange: (location: string) => void;
  onError: (message: string) => void;
  onExitBlocked: () => void;
}
export interface StationGame {
  destroy: () => void;
  pause: (paused: boolean) => void;
  unlockExit: (unlocked: boolean) => void;
  talk: () => void;
}
export interface GameCanvasProps {
  paused: boolean;
  exitUnlocked: boolean;
  onExitBlocked: () => void;
  onTalk: (id: string) => void;
  onReadyChange: (ready: boolean) => void;
  onLocationChange: (location: string) => void;
}
export interface NpcActor {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  label: Phaser.GameObjects.Text;
  elapsed: number;
}
