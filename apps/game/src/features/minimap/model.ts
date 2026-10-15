import type { Point } from '../../types/gameplay/world';

export type MinimapMode = 'hidden' | 'visible';
export interface MinimapPerson extends Point { id: string; name: string; objective: boolean }
export interface MinimapSnapshot {
  mapId: string;
  name: string;
  width: number;
  height: number;
  image: CanvasImageSource;
  player: Point;
  npcs: readonly MinimapPerson[];
  portals: readonly (Point & { id: string; label: string })[];
}
export function projectPoint(point: Point, map: { width: number; height: number }, box: { width: number; height: number }): Point {
  const scale = Math.min(box.width / map.width, box.height / map.height);
  return {
    x: (box.width - map.width * scale) / 2 + Math.max(0, Math.min(map.width, point.x)) * scale,
    y: (box.height - map.height * scale) / 2 + Math.max(0, Math.min(map.height, point.y)) * scale,
  };
}
export const MINIMAP_STORAGE_KEY = 'life-abroad:minimap';
export function nextMode(mode: MinimapMode): MinimapMode {
  return mode === 'hidden' ? 'visible' : 'hidden';
}
export function readMode(storage: Pick<Storage, 'getItem'> | undefined, width: number): MinimapMode {
  try {
    const mode = storage?.getItem(MINIMAP_STORAGE_KEY);
    if (mode === 'hidden' || mode === 'visible') return mode;
    if (mode === 'collapsed') return 'hidden';
    if (mode === 'normal' || mode === 'expanded') return 'visible';
  } catch { /* Device storage can be unavailable. */ }
  return width < 1024 ? 'hidden' : 'visible';
}
