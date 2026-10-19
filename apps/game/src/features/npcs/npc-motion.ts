import type { Direction, Point } from '../../types/gameplay/world';

export const NPC_STOP_DISTANCE = 60;
export const NPC_TURN_PAUSE_MS = 2500;

type Motion = { path: readonly Point[]; speed: number };
export interface NpcPatrol { points: readonly Point[]; startWaypoint: number }
const still: Motion = { path: [], speed: 0 };
const horizontal = (distance: number, speed: number): Motion => ({ path: [{ x: distance, y: 0 }, { x: -distance, y: 0 }, { x: 0, y: 0 }], speed });
const vertical = (distance: number, speed: number): Motion => ({ path: [{ x: 0, y: distance }, { x: 0, y: -distance }, { x: 0, y: 0 }], speed });
const profiles: Record<string, Motion> = {
  npc_station_information: still,
  npc_passenger_backpack: horizontal(40, 28),
  npc_passenger_suitcase: vertical(28, 20),
  npc_mia: still,
  npc_cafe_waiter: { path: [{ x: 28, y: 0 }, { x: 28, y: 24 }, { x: 0, y: 24 }, { x: 0, y: 0 }], speed: 30 },
  npc_cafe_customer: still,
  npc_corner_cup_seller: still,
  npc_corner_cup_assistant: { path: [{ x: 20, y: 0 }, { x: 20, y: 18 }, { x: 0, y: 18 }, { x: 0, y: 0 }], speed: 22 },
  npc_corner_cup_customer_1: horizontal(16, 10),
  npc_corner_cup_customer_2: still,
  npc_corner_cup_customer_3: vertical(12, 8),
  npc_clothes_seller: still,
  npc_clothes_assistant: vertical(24, 22),
  npc_clothes_customer: horizontal(20, 12),
};
export interface MotionState { x: number; y: number; elapsed: number }
export type NpcPose = Point & { direction: Direction; moving: boolean };

export function patrolPose(patrol: NpcPatrol, elapsed: number, speed = 46): NpcPose {
  if (patrol.points.length < 2 || patrol.startWaypoint >= patrol.points.length) {
    const point = patrol.points[patrol.startWaypoint] ?? patrol.points[0] ?? { x: 0, y: 0 };
    return { ...point, direction: 'down', moving: false };
  }
  const points = patrol.points;
  const start = patrol.startWaypoint;
  const cycle = [
    ...points.slice(start),
    ...points.slice(0, -1).reverse(),
    ...points.slice(1, start),
  ].filter((point, index, path) => index === 0 || point.x !== path[index - 1]?.x || point.y !== path[index - 1]?.y);
  if (cycle.at(-1)?.x === cycle[0]?.x && cycle.at(-1)?.y === cycle[0]?.y) cycle.pop();
  const segments = cycle.map((origin, index) => {
    const destination = cycle[(index + 1) % cycle.length] ?? origin;
    const dx = destination.x - origin.x;
    const dy = destination.y - origin.y;
    const direction: Direction = Math.abs(dx) > Math.abs(dy)
      ? dx < 0 ? 'left' : 'right'
      : dy < 0 ? 'up' : 'down';
    return { origin, destination, dx, dy, direction, duration: Math.hypot(dx, dy) / speed * 1000 };
  }).filter(segment => segment.duration > 0);
  const turnPauses = segments.map((segment, index) =>
    segment.direction === segments[(index + 1) % segments.length]?.direction ? 0 : NPC_TURN_PAUSE_MS,
  );
  const duration = segments.reduce((sum, segment, index) => sum + segment.duration + (turnPauses[index] ?? 0), 0);
  let clock = Math.max(0, elapsed) % duration;
  for (const [index, segment] of segments.entries()) {
    if (clock < segment.duration) {
      const amount = clock / segment.duration;
      return {
        x: segment.origin.x + segment.dx * amount,
        y: segment.origin.y + segment.dy * amount,
        direction: segment.direction,
        moving: true,
      };
    }
    clock -= segment.duration;
    const turnPause = turnPauses[index] ?? 0;
    if (clock < turnPause) return { ...segment.destination, direction: segment.direction, moving: false };
    clock -= turnPause;
  }
  return { ...cycle[0]!, direction: 'down', moving: false };
}

// All maps use the same route clock. A map may clip authored offsets to its walkable area.
export function npcPose(id: string, anchor: Point, elapsed: number, clip: (anchor: Point, offset: Point) => Point = (origin, offset) => ({ x: origin.x + offset.x, y: origin.y + offset.y })): NpcPose {
  const profile = profiles[id] ?? still;
  if (!profile.path.length) return { x: anchor.x, y: anchor.y, direction: 'down', moving: false };
  const points = [anchor, ...profile.path.map(offset => clip(anchor, offset))];
  const segments = points.slice(1).map((end, index) => {
    const start = points[index]!;
    return { start, end, duration: Math.hypot(end.x - start.x, end.y - start.y) / profile.speed * 1000 };
  });
  const cycle = segments.reduce((sum, segment) => sum + segment.duration, 0);
  let clock = Math.max(0, elapsed) % cycle;
  for (const segment of segments) {
    const dx = segment.end.x - segment.start.x, dy = segment.end.y - segment.start.y;
    const direction: Direction = Math.abs(dx) > Math.abs(dy) ? dx < 0 ? 'left' : 'right' : dy < 0 ? 'up' : 'down';
    if (clock < segment.duration) {
      const amount = clock / segment.duration;
      return { x: segment.start.x + dx * amount, y: segment.start.y + dy * amount, direction, moving: true };
    }
    clock -= segment.duration;
  }
  return { x: anchor.x, y: anchor.y, direction: 'down', moving: false };
}

export function advanceNpc(id: string, state: MotionState, anchor: Point, player: Point, delta: number, paused: boolean, selected: string | null, clip?: (anchor: Point, offset: Point) => Point, patrol?: NpcPatrol, stopWhenNearby = true): NpcPose {
  if (paused || selected === id || (stopWhenNearby && Math.hypot(player.x - state.x, player.y - state.y) <= NPC_STOP_DISTANCE)) return { x: state.x, y: state.y, direction: 'down', moving: false };
  state.elapsed += Math.max(0, Math.min(delta, 50));
  const pose = patrol ? patrolPose(patrol, state.elapsed) : npcPose(id, anchor, state.elapsed, clip);
  state.x = pose.x; state.y = pose.y;
  return pose;
}
