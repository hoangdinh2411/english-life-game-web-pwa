import type {
  Bounds,
  Point,
  StationNpc,
  StationPortal,
} from "../types/gameplay/world";

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
export const STREET_PORTALS: StationPortal[] = [
  CORNER_CUP_PORTAL,
  {
    id: "station",
    label: "Train Station",
    ...scaleStreetPoint({ x: 768, y: 210 }),
  },
];
export function streetSpawnPoint(arrival: "station" | "corner_cafe"): Point {
  if (arrival === "corner_cafe") {
    // Place the player directly in front of the café ring on the cross street,
    // just outside its auto-entry radius so returning does not reopen the café.
    return { x: CORNER_CUP_PORTAL.x, y: CORNER_CUP_PORTAL.y + 45 };
  }
  // Leave the train station outside its auto-entry ring to avoid bouncing back inside.
  return scaleStreetPoint({ x: 768, y: 255 });
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

// These walkable areas and building footprints follow the replaced 1536×1024
// expanded map: the station approach, plaza, three cross streets and riverwalk.
const streetRoads: Bounds[] = [
  { left: 714, right: 822, top: 150, bottom: 965 }, // Full paved width between the central promenade's curbs
  { left: 375, right: 630, top: 374, bottom: 385 }, // Clear sidewalk below Tax Office steps
  { left: 930, right: 1160, top: 374, bottom: 385 }, // Clear sidewalk below Police steps, before the planted beds
  { left: 500, right: 1036, top: 300, bottom: 610 }, // Paved plaza and paths around the fountain
  { left: 0, right: 1536, top: 600, bottom: 650 }, // Road in front of the shops
  { left: 0, right: 1536, top: 855, bottom: 900 }, // Road in front of southern buildings
];
const streetObstacles: Bounds[] = [
  // Station and civic-building footprints, including their front steps.
  { left: 0, right: 710, top: 0, bottom: 245 }, // Train platforms and west station wing
  { left: 826, right: 1536, top: 0, bottom: 245 }, // East station wing and platform
  { left: 0, right: 300, top: 0, bottom: 320 }, // Library and steps
  { left: 350, right: 660, top: 0, bottom: 350 }, // Tax Office and steps
  { left: 875, right: 1210, top: 0, bottom: 350 }, // Police station and steps
  { left: 1260, right: 1536, top: 0, bottom: 320 }, // Workplace and steps
  { left: 711, right: 825, top: 389, bottom: 490 }, // Fountain basin and surrounding flower pots
  { left: 610, right: 680, top: 292, bottom: 365 }, // North-west plaza planters
  { left: 856, right: 926, top: 292, bottom: 365 }, // North-east plaza planters
  { left: 510, right: 555, top: 475, bottom: 540 }, // South-west plaza planter
  { left: 980, right: 1026, top: 475, bottom: 540 }, // South-east plaza planter
  { left: 0, right: 285, top: 390, bottom: 575 }, // Clothes shop, including its roof
  { left: 355, right: 660, top: 390, bottom: 590 }, // Corner Cup Cafe roof, facade and steps
  { left: 880, right: 1240, top: 390, bottom: 590 }, // Restaurant roof and steps
  { left: 1270, right: 1536, top: 390, bottom: 590 }, // Supermarket roof and steps
  { left: 55, right: 410, top: 650, bottom: 850 }, // Bank and steps
  { left: 425, right: 680, top: 650, bottom: 850 }, // Hospital and steps stop west of the central promenade
  { left: 875, right: 1260, top: 650, bottom: 850 }, // Stationery Shop and steps
  // Fixed street furniture, planters, trees, and shop patio items.
  { left: 565, right: 625, top: 440, bottom: 505 }, // Plaza bench and planting
  { left: 910, right: 970, top: 440, bottom: 505 }, // Plaza bench and planting
  { left: 320, right: 490, top: 525, bottom: 590 }, // Corner Cup patio tables and umbrellas
  { left: 990, right: 1205, top: 520, bottom: 600 }, // Restaurant patio tables and umbrellas
  { left: 1320, right: 1490, top: 520, bottom: 600 }, // Supermarket carts and display
  { left: 98, right: 114, top: 900, bottom: 930 }, // Riverwalk tree trunk
  { left: 345, right: 360, top: 862, bottom: 886 }, // Southern garden tree trunk
  { left: 1170, right: 1186, top: 862, bottom: 886 }, // Stationery shop garden tree trunk
  { left: 460, right: 485, top: 335, bottom: 365 }, // North-west lamp post
  { left: 1045, right: 1070, top: 335, bottom: 365 }, // North-east lamp post
  { left: 468, right: 480, top: 590, bottom: 618 }, // West shop-front lamp post
  { left: 1232, right: 1244, top: 590, bottom: 618 }, // East shop-front lamp post
];
const insideStreet = (point: Point, rect: Bounds): boolean =>
  point.x >= rect.left &&
  point.x <= rect.right &&
  point.y >= rect.top &&
  point.y <= rect.bottom;

export function canWalkStreet(point: Point): boolean {
  const sourcePoint = {
    x: point.x / STREET_MAP_SCALE,
    y: point.y / STREET_MAP_SCALE,
  };
  return (
    streetRoads.some((road) => insideStreet(sourcePoint, road)) &&
    !streetObstacles.some((obstacle) => insideStreet(sourcePoint, obstacle))
  );
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

export const STATION_NPCS: StationNpc[] = [
  {
    id: "npc_passenger_backpack",
    name: "Peter",
    texture: "backpack",
    x: 592,
    y: 380,
  },
  {
    id: "npc_passenger_suitcase",
    name: "Emma",
    texture: "suitcase",
    x: 950,
    y: 380,
  },
  {
    id: "npc_station_information",
    name: "Ruth",
    texture: "receptionist",
    x: 850,
    y: 615,
  },
];
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
