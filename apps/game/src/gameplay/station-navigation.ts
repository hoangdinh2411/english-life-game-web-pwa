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
// Coordinates match the spacious Town Street illustration. Portals sit on the
// broad public pavement directly outside each venue's front door.
export const CORNER_CUP_PORTAL: StationPortal = {
  id: "corner_cafe",
  label: "Corner Cup Café",
  ...scaleStreetPoint({ x: 150, y: 610 }),
};
export const TAX_OFFICE_PORTAL: StationPortal = {
  id: "tax_office",
  label: "Tax Office",
  ...scaleStreetPoint({ x: 500, y: 365 }),
};
export const STREET_PORTALS: StationPortal[] = [
  TAX_OFFICE_PORTAL,
  CORNER_CUP_PORTAL,
  {
    id: "station",
    label: "Train Station",
    ...scaleStreetPoint({ x: 768, y: 145 }),
  },
];
export function streetSpawnPoint(arrival: "station" | "corner_cafe" | "tax_office"): Point {
  if (arrival === "tax_office") {
    return { x: TAX_OFFICE_PORTAL.x, y: TAX_OFFICE_PORTAL.y + 45 };
  }
  if (arrival === "corner_cafe") {
    // Place the player directly in front of the café ring on the cross street,
    // just outside its auto-entry radius so returning does not reopen the café.
    return { x: CORNER_CUP_PORTAL.x, y: CORNER_CUP_PORTAL.y + 45 };
  }
  // Leave the train station outside its auto-entry ring to avoid bouncing back inside.
  return scaleStreetPoint({ x: 768, y: 180 });
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
): Promise<boolean> {
  try {
    const authorized = await authorize();
    if (authorized) enter();
    return authorized;
  } catch {
    /* Failed authorization leaves the player at the station. */
    return false;
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
  maxDistance = 110,
): StationNpc | null {
  return (
    npcs
      .filter((npc) => {
        const threshold = npc.id === "npc_airport_agent" ? 200 : maxDistance;
        return Math.hypot(npc.x - point.x, npc.y - point.y) <= threshold;
      })
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

// Airport interiors share the authored 1536x1024 canvas; feet coordinates.
export const AIRPORT_BOUNDS: Bounds = { left: 0, right: 1536, top: 0, bottom: 1024 };
export const AIRPORT_SPAWN_POINT: Point = { x: 768, y: 600 };
export const AIRPORT_AGENT_POINT: Point = { x: 684, y: 310 };
export const AIRPORT_DEPARTURE_GATE: StationPortal = { id: "airport_arrival", label: "Departure Gate", x: 1322, y: 230 };
export const AIRPORT_DEPARTURE_PORTALS: StationPortal[] = [
  AIRPORT_DEPARTURE_GATE,
];

export const AIRPORT_DEPARTURE_OBSTACLES: readonly Bounds[] = [
  // 3 check-in desks, luggage scales, conveyor belts, and staff counter
  { left: 0, right: 1220, top: 0, bottom: 450 },
  // Gate archway right wall
  { left: 1435, right: 1536, top: 0, bottom: 450 },
  // Back wall above gate archway portal
  { left: 1220, right: 1435, top: 0, bottom: 200 },
  // Left seating lounge chairs and planters along left wall
  { left: 0, right: 230, top: 250, bottom: 850 },
  // Bottom wall left of entrance
  { left: 0, right: 650, top: 920, bottom: 1024 },
  // Bottom wall right of entrance
  { left: 900, right: 1536, top: 920, bottom: 1024 },
];

export const AIRPORT_ARRIVAL_OBSTACLES: readonly Bounds[] = [
  // Top wall and staff tables across the top
  { left: 0, right: 1536, top: 0, bottom: 330 },
  // Central baggage claim carousel
  { left: 350, right: 1180, top: 345, bottom: 685 },
  // Left chairs & planters
  { left: 140, right: 270, top: 280, bottom: 740 },
  // Right chairs & planters
  { left: 1270, right: 1400, top: 280, bottom: 740 },
  // Bottom wall left of exit
  { left: 0, right: 670, top: 750, bottom: 1024 },
  // Bottom wall right of exit
  { left: 860, right: 1536, top: 750, bottom: 1024 },
];

export function airportSpawnPoint(location: "airport_departure" | "airport_arrival" = "airport_departure"): Point {
  return location === "airport_arrival" ? { x: 768, y: 720 } : { x: 768, y: 700 };
}

export function canWalkAirport(
  locationOrPoint: "airport_departure" | "airport_arrival" | Point = "airport_departure",
  pointOrNpcs?: Point | readonly Point[],
  maybeNpcs: readonly Point[] = [],
): boolean {
  const isLocation = typeof locationOrPoint === "string";
  const location: "airport_departure" | "airport_arrival" = isLocation ? locationOrPoint : "airport_departure";
  const point: Point = isLocation ? (pointOrNpcs as Point) : locationOrPoint;
  const npcs: readonly Point[] = isLocation ? (maybeNpcs ?? []) : (Array.isArray(pointOrNpcs) ? pointOrNpcs : []);

  if (location === "airport_arrival") {
    if (point.x < 190 || point.x > 1360 || point.y < 280 || point.y > 950) return false;
    if (point.y > 750 && (point.x < 670 || point.x > 860)) return false;
    if (AIRPORT_ARRIVAL_OBSTACLES.some((o) => point.x >= o.left && point.x <= o.right && point.y >= o.top && point.y <= o.bottom)) {
      return false;
    }
  } else {
    if (point.x < 180 || point.x > 1460 || point.y < 210 || point.y > 950) return false;
    if (point.y > 920 && (point.x < 650 || point.x > 900)) return false;
    if (AIRPORT_DEPARTURE_OBSTACLES.some((o) => point.x >= o.left && point.x <= o.right && point.y >= o.top && point.y <= o.bottom)) {
      return false;
    }
  }

  return !npcs.some((npc) => {
    const dx = Math.abs(point.x - npc.x);
    const dy = Math.abs(point.y - npc.y);
    return (dx < 32 && dy < 48) || Math.hypot(point.x - npc.x, point.y - npc.y) < 42;
  });
}

export function recoverAirportPosition(
  point: Point,
  location: "airport_departure" | "airport_arrival" = "airport_departure",
): Point {
  if (canWalkAirport(location, point)) return point;
  return airportSpawnPoint(location);
}

export function moveInAirport(
  locationOrStart: "airport_departure" | "airport_arrival" | Point = "airport_departure",
  startOrDelta?: Point,
  deltaOrNpcs?: Point | readonly Point[],
  maybeNpcs: readonly Point[] = [],
): Point {
  const isLocation = typeof locationOrStart === "string";
  const location: "airport_departure" | "airport_arrival" = isLocation ? locationOrStart : "airport_departure";
  const start: Point = isLocation ? startOrDelta! : locationOrStart;
  const delta: Point = isLocation ? (deltaOrNpcs as Point) : startOrDelta!;
  const npcs: readonly Point[] = isLocation ? maybeNpcs : (Array.isArray(deltaOrNpcs) ? deltaOrNpcs : []);

  let point = { ...start };
  const steps = Math.max(1, Math.ceil(Math.hypot(delta.x, delta.y) / 4));
  for (let step = 0; step < steps; step++) {
    const next = { x: point.x + delta.x / steps, y: point.y + delta.y / steps };
    if (canWalkAirport(location, next, npcs)) point = next;
    else {
      const horizontal = { x: next.x, y: point.y };
      const vertical = { x: point.x, y: next.y };
      if (canWalkAirport(location, horizontal, npcs)) point = horizontal;
      if (canWalkAirport(location, vertical, npcs)) point = vertical;
    }
  }
  return point;
}

