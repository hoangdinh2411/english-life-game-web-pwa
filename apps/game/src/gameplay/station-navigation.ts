import type {
  Bounds,
  MapLocation,
  Point,
  StationNpc,
  StationPortal,
} from "../types/gameplay/world";
import { STATION_ROSTER } from "../features/station/station-roster";
import { canWalkTownStreet } from "../features/location/town-street-collision";

export const STREET_MAP_SCALE = 1.5;
export const STREET_MAP_SIZE = {
  width: 1536 * STREET_MAP_SCALE,
  height: 1024 * STREET_MAP_SCALE,
};
export function scaleStreetPoint(point: Point): Point {
  return { x: point.x * STREET_MAP_SCALE, y: point.y * STREET_MAP_SCALE };
}
// Coordinates match the expanded Town Street illustration. The café ring
// sits on the road immediately outside its front door.
export const CORNER_CUP_PORTAL: StationPortal = {
  id: "corner_cafe",
  label: "Corner Cup Café",
  ...scaleStreetPoint({ x: 505, y: 600 }),
};
export const TAX_OFFICE_PORTAL: StationPortal = {
  id: "tax_office",
  label: "Tax Office",
  ...scaleStreetPoint({ x: 505, y: 379 }),
};
export const STREET_PORTALS: StationPortal[] = [
  TAX_OFFICE_PORTAL,
  CORNER_CUP_PORTAL,
  {
    id: "station",
    label: "Train Station",
    ...scaleStreetPoint({ x: 768, y: 210 }),
  },
];
export function streetSpawnPoint(arrival: "station" | "corner_cafe" | "tax_office"): Point {
  if (arrival === "tax_office") {
    // The space below this doorway is landscaped and blocks all movement.
    // Return beside the ring on the connected road, outside its re-entry radius.
    return { x: TAX_OFFICE_PORTAL.x + 45, y: TAX_OFFICE_PORTAL.y };
  }
  if (arrival === "corner_cafe") {
    // Place the player directly in front of the café ring on the cross street,
    // just outside its auto-entry radius so returning does not reopen the café.
    return { x: CORNER_CUP_PORTAL.x, y: CORNER_CUP_PORTAL.y + 45 };
  }
  // Leave the train station outside its auto-entry ring to avoid bouncing back inside.
  return scaleStreetPoint({ x: 768, y: 255 });
}

export function streetArrivalForLocation(location: MapLocation): "station" | "corner_cafe" | "tax_office" {
  if (location === "tax_office") return "tax_office";
  if (location === "corner_cafe") return "corner_cafe";
  return "station";
}
export function clampStreetPosition(point: Point): Point {
  return {
    x: Math.max(
      48 * STREET_MAP_SCALE,
      Math.min((1536 - 48) * STREET_MAP_SCALE, point.x),
    ),
    y: Math.max(
      110 * STREET_MAP_SCALE,
      Math.min((1024 - 39) * STREET_MAP_SCALE, point.y),
    ),
  };
}

export function canWalkStreet(point: Point): boolean {
  return canWalkTownStreet({ x: point.x / STREET_MAP_SCALE, y: point.y / STREET_MAP_SCALE });
}

export function recoverStreetPosition(point: Point): Point {
  return canWalkStreet(point) && !portalAt(point, STREET_PORTALS)
    ? point
    : streetSpawnPoint("station");
}

export function moveOnStreet(point: Point, delta: Point): Point {
  const steps = Math.max(1, Math.ceil(Math.hypot(delta.x, delta.y) / 4));
  let result = { ...point };
  for (let step = 0; step < steps; step++) {
    const next = {
      x: result.x + delta.x / steps,
      y: result.y + delta.y / steps,
    };
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

export const STATION_NPCS: StationNpc[] = STATION_ROSTER.map(npc => ({ ...npc }));
export const STATION_PORTALS: StationPortal[] = [
  { id: "cafe", label: "Café", x: 420, y: 750 },
  { id: "clothes", label: "Clothes Shop", x: 1090, y: 750 },
  { id: "street", label: "Town Street", x: 768, y: 944 },
];
export function stationStoreReturnPoint(portal: StationPortal): Point {
  return { x: portal.x + (portal.id === "cafe" ? 70 : -70), y: portal.y };
}
export function portalAt(
  point: Point,
  portals: StationPortal[],
  radius = 38,
): StationPortal | null {
  return (
    portals.find(
      (portal) => Math.hypot(point.x - portal.x, point.y - portal.y) <= radius,
    ) ?? null
  );
}

export async function authorizeStreetExit(
  authorize: () => Promise<boolean>,
  enter: () => void,
): Promise<void> {
  try {
    if (await authorize()) enter();
  } catch {
    /* Failed authorization leaves the player at the station. */
  }
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
const inside = (point: Point, rect: Bounds): boolean =>
  point.x >= rect.left &&
  point.x <= rect.right &&
  point.y >= rect.top &&
  point.y <= rect.bottom;
export function canWalk(point: Point): boolean {
  return (
    paths.some((rect) => inside(point, rect)) &&
    !obstacles.some((rect) => inside(point, rect))
  );
}

export function movePlayer(point: Point, delta: Point): Point {
  // Small substeps stop long frames/taps from tunneling through obstructions.
  const steps = Math.max(1, Math.ceil(Math.hypot(delta.x, delta.y) / 4));
  let result = { ...point };
  for (let step = 0; step < steps; step++) {
    const next = {
      x: result.x + delta.x / steps,
      y: result.y + delta.y / steps,
    };
    if (!canWalk(next)) break;
    result = next;
  }
  return result;
}

export function movementDelta(
  direction: Point,
  speed: number,
  keyboard: boolean,
): Point {
  const distance = Math.hypot(direction.x, direction.y);
  if (!distance || (!keyboard && distance <= 3)) return { x: 0, y: 0 };
  const step = keyboard ? speed : Math.min(speed, distance);
  return {
    x: (direction.x / distance) * step,
    y: (direction.y / distance) * step,
  };
}

export function nearestNpc(
  point: Point,
  npcs: StationNpc[] = STATION_NPCS,
): StationNpc | null {
  return (
    npcs
      .filter((npc) => Math.hypot(npc.x - point.x, npc.y - point.y) <= 110)
      .sort(
        (a, b) =>
          Math.hypot(a.x - point.x, a.y - point.y) -
          Math.hypot(b.x - point.x, b.y - point.y),
      )[0] ?? null
  );
}

export function findPath(
  start: Point,
  target: Point,
  walkable: (point: Point) => boolean = canWalk,
  move: (point: Point, delta: Point) => Point = movePlayer,
): Point[] {
  if (!walkable(target)) return [];
  const snap = (point: Point): Point => ({
    x: Math.round(point.x / 16) * 16,
    y: Math.round(point.y / 16) * 16,
  });
  const reaches = (from: Point, to: Point): boolean => {
    const reached = move(from, { x: to.x - from.x, y: to.y - from.y });
    return Math.hypot(reached.x - to.x, reached.y - to.y) <= 0.1;
  };
  const snapToReachable = (
    point: Point,
    canConnect: (candidate: Point) => boolean,
  ): Point | null => {
    const center = snap(point);
    const candidates: Point[] = [];
    for (let radius = 0; radius <= 2; radius++) {
      for (let x = -radius; x <= radius; x++) {
        for (let y = -radius; y <= radius; y++) {
          if (Math.max(Math.abs(x), Math.abs(y)) !== radius) continue;
          candidates.push({ x: center.x + x * 16, y: center.y + y * 16 });
        }
      }
    }
    candidates.sort(
      (a, b) =>
        Math.hypot(a.x - point.x, a.y - point.y) -
        Math.hypot(b.x - point.x, b.y - point.y),
    );
    return (
      candidates.find(
        (candidate) => walkable(candidate) && canConnect(candidate),
      ) ?? null
    );
  };
  const key = (point: Point): string => `${point.x},${point.y}`;
  if (!walkable(start) || !walkable(target)) return [];
  const origin = snapToReachable(start, (candidate) =>
    reaches(start, candidate),
  );
  const goal = snapToReachable(target, (candidate) =>
    reaches(candidate, target),
  );
  if (!origin || !goal) return [];
  const queue = [origin],
    previous = new Map<string, Point | null>([[key(origin), null]]);
  for (let index = 0; index < queue.length; index++) {
    const point = queue[index];
    if (!point) continue;
    if (key(point) === key(goal)) {
      const path = [target];
      let current: Point | null = point;
      while (current) {
        path.unshift(current);
        current = previous.get(key(current)) ?? null;
      }
      return path;
    }
    for (const delta of [
      { x: 16, y: 0 },
      { x: -16, y: 0 },
      { x: 0, y: 16 },
      { x: 0, y: -16 },
    ]) {
      const next = { x: point.x + delta.x, y: point.y + delta.y };
      if (previous.has(key(next)) || !walkable(next)) continue;
      const reached = move(point, delta);
      if (Math.hypot(reached.x - next.x, reached.y - next.y) > 0.1) continue;
      previous.set(key(next), point);
      queue.push(next);
    }
  }
  return [];
}
