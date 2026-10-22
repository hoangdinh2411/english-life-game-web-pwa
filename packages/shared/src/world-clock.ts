import { z } from 'zod';

export const worldClockSnapshotSchema = z.object({
  gameTimeUtc: z.string().datetime(),
  timeZone: z.string().min(1),
  clockRate: z.number().int().positive(),
}).strict();

export type WorldClockSnapshot = z.infer<typeof worldClockSnapshotSchema>;
