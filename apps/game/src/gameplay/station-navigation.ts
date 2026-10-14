import type { Bounds, Point, StationNpc, StationPortal } from '../types/gameplay/world';

export const STREET_MAP_SCALE = 1.5;
export const STREET_MAP_SIZE = { width: 1536 * STREET_MAP_SCALE, height: 1024 * STREET_MAP_SCALE };
export function scaleStreetPoint(point: Point): Point {
  return { x: point.x * STREET_MAP_SCALE, y: point.y * STREET_MAP_SCALE };
}
export function streetSpawnPoint(returningFromStreetPortal: boolean): Point {
  return scaleStreetPoint(returningFromStreetPortal ? { x: 1260, y: 620 } : { x: 768, y: 210 });
}
export function clampStreetPosition(point: Point): Point {
  return {
    x: Math.max(48 * STREET_MAP_SCALE, Math.min((1536 - 48) * STREET_MAP_SCALE, point.x)),
    y: Math.max(110 * STREET_MAP_SCALE, Math.min((1024 - 39) * STREET_MAP_SCALE, point.y)),
  };
}

// Match the station map's walkable-rectangle + obstacle-rectangle model. These
// rectangles follow the visible center walk, cross streets, and river walk in
// the 1536×1024 map art; areas behind buildings are not treated as roads.
const streetRoads: Bounds[] = [
  { left: 700, right: 836, top: 90, bottom: 960 }, // Main north-south walk
  { left: 520, right: 1016, top: 300, bottom: 550 }, // Central plaza around fountain
  { left: 0, right: 1536, top: 395, bottom: 435 }, // Upper cross street
  { left: 0, right: 1536, top: 600, bottom: 645 }, // Street below the middle buildings
  { left: 0, right: 1536, top: 880, bottom: 930 }, // River walk
  { left: 1238, right: 1300, top: 415, bottom: 610 }, // Corner Cup approach
];
const streetObstacles: Bounds[] = [
  { left: 711, right: 825, top: 389, bottom: 467 }, // Fountain basin, leaving its paved circular walk open
  { left: 630, right: 680, top: 292, bottom: 370 }, // North-west plaza tree
  { left: 856, right: 906, top: 292, bottom: 370 }, // North-east plaza tree
  { left: 510, right: 550, top: 448, bottom: 520 }, // South-west plaza tree
  { left: 986, right: 1026, top: 448, bottom: 520 }, // South-east plaza tree
  { left: 0, right: 225, top: 0, bottom: 290 }, // North-west homes and shop
  { left: 280, right: 590, top: 205, bottom: 390 }, // North-west market
  { left: 940, right: 1220, top: 205, bottom: 390 }, // North-east shop
  { left: 1300, right: 1536, top: 0, bottom: 300 }, // North-east pharmacy
  { left: 270, right: 455, top: 440, bottom: 595 }, // Middle-left house
  { left: 1035, right: 1250, top: 435, bottom: 595 }, // Corner Cup building
  { left: 1315, right: 1536, top: 370, bottom: 590 }, // Post office building
  { left: 0, right: 235, top: 690, bottom: 875 }, // South-west shop
  { left: 260, right: 460, top: 690, bottom: 875 }, // South-west house
  { left: 475, right: 700, top: 690, bottom: 875 }, // South-centre shop
  { left: 900, right: 1100, top: 690, bottom: 875 }, // South-east house
  { left: 1200, right: 1536, top: 690, bottom: 875 }, // South-east homes
];
const insideStreet = (point: Point, rect: Bounds): boolean => point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;

export function canWalkStreet(point: Point): boolean {
  const sourcePoint = { x: point.x / STREET_MAP_SCALE, y: point.y / STREET_MAP_SCALE };
  return streetRoads.some((road) => insideStreet(sourcePoint, road))
    && !streetObstacles.some((obstacle) => insideStreet(sourcePoint, obstacle));
}

export function moveOnStreet(point: Point, delta: Point): Point {
  const steps = Math.max(1, Math.ceil(Math.hypot(delta.x, delta.y) / 4));
  let result = { ...point };
  for (let step = 0; step < steps; step++) {
    const next = { x: result.x + delta.x / steps, y: result.y + delta.y / steps };
    if (canWalkStreet(next)) result = next;
    else {
      const horizontal = { x: next.x, y: result.y };
      const vertical = { x: result.x, y: next.y };
      if (canWalkStreet(horizontal)) result = horizontal;
      if (canWalkStreet(vertical)) result = vertical;
    }
  }
  // Movement substeps already enforce the map edge because no road corridor
  // extends outside it. Clamping here would teleport an invalid position back
  // across an obstacle or onto a non-road point.
  return result;
}

export const STATION_NPCS: StationNpc[] = [
  { id: 'npc_passenger_backpack', name: 'Peter', texture: 'backpack', x: 592, y: 380 },
  { id: 'npc_passenger_suitcase', name: 'Emma', texture: 'suitcase', x: 950, y: 380 },
  { id: 'npc_station_information', name: 'Ruth', texture: 'receptionist', x: 850, y: 615 },
];
export const STATION_PORTALS: StationPortal[] = [
  { id: 'cafe', label: 'Café', x: 420, y: 750 },
  { id: 'clothes', label: 'Clothes Shop', x: 1090, y: 750 },
  { id: 'street', label: 'Town Street', x: 768, y: 944 },
];
export function portalAt(point: Point, portals: StationPortal[], radius = 38): StationPortal | null {
  return portals.find((portal) => Math.hypot(point.x - portal.x, point.y - portal.y) <= radius) ?? null;
}

export async function authorizeStreetExit(authorize: () => Promise<boolean>, enter: () => void): Promise<void> {
  try { if (await authorize()) enter(); } catch { /* Failed authorization leaves the player at the station. */ }
}

// Coordinates describe feet on the flattened 1536×1024 station illustration.
const paths = [
  { left: 540, right: 985, top: 350, bottom: 750 },
  { left: 590, right: 945, top: 735, bottom: 970 },
  { left: 130, right: 1410, top: 740, bottom: 780 },
];
const obstacles = [
  { left: 670, right: 850, top: 420, bottom: 595 },
  { left: 565, right: 625, top: 442, bottom: 515 },
  { left: 900, right: 965, top: 440, bottom: 515 },
  { left: 565, right: 625, top: 615, bottom: 685 },
  { left: 900, right: 965, top: 610, bottom: 675 },
];
const inside = (point: Point, rect: Bounds): boolean => point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
export function canWalk(point: Point): boolean { return paths.some((rect) => inside(point, rect)) && !obstacles.some((rect) => inside(point, rect)); }

export function movePlayer(point: Point, delta: Point): Point {
  // Small substeps stop long frames/taps from tunneling through obstructions.
  const steps = Math.max(1, Math.ceil(Math.hypot(delta.x, delta.y) / 4));
  let result = { ...point };
  for (let step = 0; step < steps; step++) {
    const next = { x: result.x + delta.x / steps, y: result.y + delta.y / steps };
    if (!canWalk(next)) break;
    result = next;
  }
  return result;
}

export function movementDelta(direction: Point, speed: number, keyboard: boolean): Point {
  const distance = Math.hypot(direction.x, direction.y);
  if (!distance || (!keyboard && distance <= 3)) return { x: 0, y: 0 };
  const step = keyboard ? speed : Math.min(speed, distance);
  return { x: direction.x / distance * step, y: direction.y / distance * step };
}

export function nearestNpc(point: Point, npcs: StationNpc[] = STATION_NPCS): StationNpc | null {
  return npcs.filter((npc) => Math.hypot(npc.x - point.x, npc.y - point.y) <= 110)
    .sort((a, b) => Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y))[0] ?? null;
}

export function findPath(start: Point, target: Point, walkable: (point: Point) => boolean = canWalk, move: (point: Point, delta: Point) => Point = movePlayer): Point[] {
  if (!walkable(target)) return [];
  const snap = (point: Point): Point => ({ x: Math.round(point.x / 16) * 16, y: Math.round(point.y / 16) * 16 });
  const key = (point: Point): string => `${point.x},${point.y}`;
  const origin = snap(start), goal = snap(target);
  if (!walkable(origin) || !walkable(goal)) return [];
  const queue = [origin], previous = new Map<string, Point | null>([[key(origin), null]]);
  for (let index = 0; index < queue.length; index++) {
    const point = queue[index];
    if (!point) continue;
    if (key(point) === key(goal)) {
      const path = [target];
      let current: Point | null = point;
      while (current) { path.unshift(current); current = previous.get(key(current)) ?? null; }
      return path;
    }
    for (const delta of [{ x: 16, y: 0 }, { x: -16, y: 0 }, { x: 0, y: 16 }, { x: 0, y: -16 }]) {
      const next = { x: point.x + delta.x, y: point.y + delta.y };
      if (previous.has(key(next)) || !walkable(next)) continue;
      const reached = move(point, delta);
      if (Math.hypot(reached.x - next.x, reached.y - next.y) > 0.1) continue;
      previous.set(key(next), point); queue.push(next);
    }
  }
  return [];
}
