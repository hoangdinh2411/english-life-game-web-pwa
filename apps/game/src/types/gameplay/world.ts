import type { Appearance, PlayerLocation } from "@life-abroad/shared";
import type { MinimapSnapshot } from "../../features/minimap/model";
import type { PlayerGender } from "@life-abroad/shared";
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
  scale?: number;
  patrol?: { points: readonly Point[]; startWaypoint: number };
}
export interface StationPortal extends Point {
  id: string;
  label: string;
}
export type Direction = "left" | "right" | "up" | "down";
export type MapLocation =
  | "station"
  | "cafe"
  | "corner_cafe"
  | "clothes"
  | "tax_office"
  | "street";
export type ClosedVenueLocation = Extract<
  MapLocation,
  "cafe" | "corner_cafe" | "clothes" | "tax_office"
>;
export interface StationCallbacks {
  gender?: PlayerGender | undefined;
  countryName?: string | undefined;
  appearance?: Appearance | undefined;
  practice?: boolean;
  onProgress: (value: number) => void;
  initialLocation?: PlayerLocation;
  onEnterStreet?: () => Promise<boolean>;
  onNearby: (id: string | null) => void;
  onTalk: (id: string) => void;
  onReady: () => void;
  onLocationChange: (location: string) => void;
  onMapChange?: (mapId: string) => void;
  onPlaceChange?: (location: PlayerLocation) => void;
  onError: (message: string) => void;
  getGameTime?: () => Date | null;
  getTimeZone?: () => string | null;
  onVenueClosed?: (location: ClosedVenueLocation) => void;
  onExitBlocked: () => void;
}
export interface StationGame {
  readMinimap: () => MinimapSnapshot | null;
  setAppearance: (appearance: Appearance | undefined) => void;
  destroy: () => void;
  pause: (
    paused: boolean,
    worldPaused?: boolean,
    conversationNpcId?: string | null,
  ) => void;
  unlockExit: (unlocked: boolean) => void;
  talk: () => void;
  setPresentNpcIds: (ids: readonly string[]) => void;
}
export interface GameCanvasProps {
  gender?: PlayerGender | undefined;
  countryName?: string | undefined;
  minimapVisible?: boolean;
  appearance?: Appearance | undefined;
  initialLocation?: PlayerLocation;
  onEnterStreet?: () => Promise<boolean>;
  paused: boolean;
  worldPaused?: boolean;
  conversationNpcId?: string | null;
  exitUnlocked: boolean;
  onExitBlocked: () => void;
  onTalk: (id: string) => void;
  onReadyChange: (ready: boolean) => void;
  onLocationChange: (location: string) => void;
  onMapChange?: (mapId: string) => void;
  presentNpcIds?: readonly string[];
  onPlaceChange?: (location: PlayerLocation) => void;
  getGameTime?: () => Date | null;
  getTimeZone?: () => string | null;
  onVenueClosed?: (location: ClosedVenueLocation) => void;
}
