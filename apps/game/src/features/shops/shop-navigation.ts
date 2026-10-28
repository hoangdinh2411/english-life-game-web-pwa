import type { Bounds, ClosedVenueLocation, MapLocation, Point } from '../../types/gameplay/world';
import { isVenueOpenAtLocalMinute, type VenueKind } from '@life-abroad/shared';
import { localWorldMinutes } from '../world-clock/world-clock';

const locationVenueKinds: Partial<Record<MapLocation, VenueKind>> = {
  cafe: 'cafe',
  corner_cafe: 'cafe',
  clothes: 'store',
  tax_office: 'organization',
};

export function canEnterLocation(location: MapLocation, gameTime: Date | null, timeZone: string | null): boolean {
  const venueKind = locationVenueKinds[location];
  return venueKind === undefined || (gameTime !== null && timeZone !== null &&
    isVenueOpenAtLocalMinute(venueKind, localWorldMinutes(gameTime, timeZone)));
}

export const shouldDeferClosedVenueExit = (conversationNpcId: string | null): boolean => conversationNpcId !== null;

export function closedVenueExit(location: MapLocation): {
  closedLocation: ClosedVenueLocation;
  location: 'station' | 'street';
  streetArrival: 'station' | 'corner_cafe' | 'tax_office';
} | null {
  if (location === 'cafe' || location === 'clothes') return { closedLocation: location, location: 'station', streetArrival: 'station' };
  if (location === 'corner_cafe' || location === 'tax_office') return { closedLocation: location, location: 'street', streetArrival: location };
  return null;
}

// Feet coordinates, measured against the authored 1536×1024 interiors.
const furniture: Record<'cafe' | 'clothes' | 'tax_office', Bounds[]> = {
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
  tax_office: [
    { left: 80, right: 1460, top: 0, bottom: 430 },
    { left: 80, right: 260, top: 430, bottom: 770 },
    { left: 1180, right: 1460, top: 430, bottom: 760 },
  ],
};
export function shopCanWalk(location: MapLocation, point: Point, npcs: readonly Point[] = []): boolean {
  if (point.x < 180 || point.x > 1380 || point.y < 325 || point.y > 985) return false;
  if (point.y > 790 && (point.x < 650 || point.x > 890)) return false;
  const obstacles = location === 'cafe' || location === 'corner_cafe' ? furniture.cafe : location === 'clothes' ? furniture.clothes : location === 'tax_office' ? furniture.tax_office : [];
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
