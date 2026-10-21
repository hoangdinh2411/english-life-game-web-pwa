import type { MapLocation } from '../../types/gameplay/world';

export function npcIsVisible(location: MapLocation, npcId: string, presentNpcIds: ReadonlySet<string> | null): boolean {
  return location === 'station' || presentNpcIds === null || presentNpcIds.has(npcId);
}
