import { worldClockSnapshotSchema, type WorldClockSnapshot } from '@life-abroad/shared';
import { request } from '../../api/client';

export async function loadWorldClock(token: string): Promise<WorldClockSnapshot> {
  return worldClockSnapshotSchema.parse(await request('world-clock', undefined, token));
}
