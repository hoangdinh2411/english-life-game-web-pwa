import type { Direction, Point } from '../../types/gameplay/world';

type Motion = { path: readonly Point[]; speed: number; wait: number };
const still: Motion = { path: [], speed: 0, wait: 0 };
const horizontal = (distance: number, speed: number, wait: number): Motion => ({ path: [{ x: distance, y: 0 }, { x: -distance, y: 0 }, { x: 0, y: 0 }], speed, wait });
const vertical = (distance: number, speed: number, wait: number): Motion => ({ path: [{ x: 0, y: distance }, { x: 0, y: -distance }, { x: 0, y: 0 }], speed, wait });
const profiles: Record<string, Motion> = {
  npc_station_information: still,
  npc_passenger_backpack: horizontal(40, 28, 900),
  npc_passenger_suitcase: vertical(28, 20, 1500),
  npc_mia: still,
  npc_cafe_waiter: { path: [{ x: 28, y: 0 }, { x: 28, y: 24 }, { x: 0, y: 24 }, { x: 0, y: 0 }], speed: 30, wait: 500 },
  npc_cafe_customer: still,
  npc_clothes_seller: still,
  npc_clothes_assistant: vertical(24, 22, 1300),
  npc_clothes_customer: horizontal(20, 12, 2300),
};
export interface MotionState { x: number; y: number; elapsed: number }
export type NpcPose = Point & { direction: Direction; moving: boolean };

// All maps use the same route clock. A map may clip authored offsets to its walkable area.
export function npcPose(id: string, anchor: Point, elapsed: number, clip: (anchor: Point, offset: Point) => Point = (origin, offset) => ({ x: origin.x + offset.x, y: origin.y + offset.y })): NpcPose {
  const profile = profiles[id] ?? still;
  if (!profile.path.length) return { x: anchor.x, y: anchor.y, direction: 'down', moving: false };
  const points = [anchor, ...profile.path.map(offset => clip(anchor, offset))];
  const segments = points.slice(1).map((end, index) => {
    const start = points[index]!;
    return { start, end, duration: Math.hypot(end.x - start.x, end.y - start.y) / profile.speed * 1000 };
  });
  const cycle = segments.reduce((sum, segment) => sum + segment.duration + profile.wait, 0);
  let clock = Math.max(0, elapsed) % cycle;
  for (const segment of segments) {
    const dx = segment.end.x - segment.start.x, dy = segment.end.y - segment.start.y;
    const direction: Direction = Math.abs(dx) > Math.abs(dy) ? dx < 0 ? 'left' : 'right' : dy < 0 ? 'up' : 'down';
    if (clock < segment.duration) {
      const amount = clock / segment.duration;
      return { x: segment.start.x + dx * amount, y: segment.start.y + dy * amount, direction, moving: true };
    }
    clock -= segment.duration;
    if (clock < profile.wait) return { ...segment.end, direction, moving: false };
    clock -= profile.wait;
  }
  return { x: anchor.x, y: anchor.y, direction: 'down', moving: false };
}

export function advanceNpc(id: string, state: MotionState, anchor: Point, player: Point, delta: number, paused: boolean, selected: string | null, clip?: (anchor: Point, offset: Point) => Point): NpcPose {
  if (paused || selected === id || Math.hypot(player.x - state.x, player.y - state.y) <= 140) return { x: state.x, y: state.y, direction: 'down', moving: false };
  state.elapsed += Math.max(0, Math.min(delta, 50));
  const pose = npcPose(id, anchor, state.elapsed, clip);
  state.x = pose.x; state.y = pose.y;
  return pose;
}
