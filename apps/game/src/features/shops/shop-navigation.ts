import type { Bounds, MapLocation, Point } from '../../types/gameplay/world';
import { isVenueOpen } from '@life-abroad/shared';

const storeLocations: readonly MapLocation[] = ['cafe', 'corner_cafe', 'clothes'];
export function canEnterLocation(location: MapLocation, gameTime: Date | null): boolean {
  return !storeLocations.includes(location) || (gameTime !== null && isVenueOpen('store', gameTime));
}

// Feet coordinates, measured against the authored 1536×1024 interiors.
const furniture: Record<'cafe' | 'clothes', Bounds[]> = {
  cafe: [
    { left: 110, right: 355, top: 335, bottom: 745 },
    { left: 1180, right: 1430, top: 325, bottom: 750 },
    { left: 385, right: 1120, top: 180, bottom: 355 },
  ],
  clothes: [
    { left: 225, right: 490, top: 350, bottom: 535 },
    { left: 215, right: 485, top: 550, bottom: 770 },
    { left: 1040, right: 1340, top: 215, bottom: 370 },
    { left: 1045, right: 1355, top: 430, bottom: 650 },
    { left: 1190, right: 1420, top: 635, bottom: 800 },
  ],
};
export function shopCanWalk(location: MapLocation, point: Point, npcs: readonly Point[] = []): boolean {
  if (point.x < 180 || point.x > 1380 || point.y < 325 || point.y > 985) return false;
  if (point.y > 790 && (point.x < 650 || point.x > 890)) return false;
  const obstacles = location === 'cafe' || location === 'corner_cafe' ? furniture.cafe : location === 'clothes' ? furniture.clothes : [];
  return !obstacles.some(rect => point.x >= rect.left - 18 && point.x <= rect.right + 18 && point.y >= rect.top - 12 && point.y <= rect.bottom + 12)
    && !npcs.some(npc => Math.hypot(point.x - npc.x, point.y - npc.y) < 38);
}
export function moveInShop(location: MapLocation, start: Point, delta: Point, npcs: readonly Point[] = []): Point {
  let point = { ...start };
  const steps = Math.max(1, Math.ceil(Math.hypot(delta.x, delta.y) / 4));
  for (let step = 0; step < steps; step++) {
    const next = { x: point.x + delta.x / steps, y: point.y + delta.y / steps };
    if (shopCanWalk(location, next, npcs)) point = next;
    else {
      const horizontal = { x: next.x, y: point.y };
      const vertical = { x: point.x, y: next.y };
      if (shopCanWalk(location, horizontal, npcs)) point = horizontal;
      if (shopCanWalk(location, vertical, npcs)) point = vertical;
    }
  }
  return point;
}
