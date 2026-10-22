import type { MapLocation } from '../../types/gameplay/world';

interface NpcPresenceTarget {
  setPresentNpcIds(ids: readonly string[]): void;
}

export function syncNpcPresence(target: NpcPresenceTarget | null, ids: readonly string[] | undefined): void {
  if (target && ids) target.setPresentNpcIds(ids);
}

export function npcIsVisible(location: MapLocation, npcId: string, presentNpcIds: ReadonlySet<string> | null): boolean {
  return location === 'station' || presentNpcIds === null || presentNpcIds.has(npcId);
}

export function effectiveNpcIds(
  selectedIds: readonly string[],
  conversationNpcId: string | null,
  currentIds: readonly string[] = selectedIds,
): ReadonlySet<string> {
  return new Set(conversationNpcId === null ? selectedIds : [...currentIds, conversationNpcId]);
}
