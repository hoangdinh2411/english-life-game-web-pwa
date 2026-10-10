import type { Direction, Point } from '../types/gameplay/world';
import { movePlayer } from './station-navigation';

// Short straight walks return home before choosing another direction.
export function npcIdlePose(anchor: Point, elapsedMs: number, index: number): Point & { direction: Direction } {
  const legs = [{ x: 48, y: 0 }, { x: 0, y: 48 }, { x: -48, y: 0 }, { x: 0, y: -48 }];
  const clock = (elapsedMs + index * 2000) % 8000;
  const segment = Math.floor(clock / 1000);
  const offset = legs[Math.floor(segment / 2) % legs.length] ?? { x: 0, y: 0 };
  const target = movePlayer(anchor, offset);
  const returning = segment % 2 === 1;
  const progress = (clock % 1000) / 1000;
  const amount = returning ? 1 - progress : progress;
  const dx = (target.x - anchor.x) * (returning ? -1 : 1);
  const dy = (target.y - anchor.y) * (returning ? -1 : 1);
  const direction = dx ? dx < 0 ? 'left' : 'right' : dy < 0 ? 'up' : 'down';
  return { x: anchor.x + (target.x - anchor.x) * amount, y: anchor.y + (target.y - anchor.y) * amount, direction };
}
