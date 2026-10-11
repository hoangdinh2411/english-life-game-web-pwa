import { z } from 'zod';

export const GAME_TIME_RATE = 2;
export const SLEEP_HOURS = 8;
export function canSleep(energy: number): boolean { return energy < 50; }
export const SHIRT_COLORS = ['blue', 'green', 'red', 'yellow'] as const;
export const appearanceSchema = z.object({
  hair: z.enum(['brown', 'black', 'blond', 'blue']),
  shirt: z.enum(SHIRT_COLORS).nullable(),
  trousers: z.enum(['navy', 'charcoal', 'brown']),
}).strict();
export type Appearance = z.infer<typeof appearanceSchema>;
export const VENUE_HOURS = { organization: [8, 16], store: [8, 20], workplace: [7, 17] } as const;
export type VenueKind = keyof typeof VENUE_HOURS;
export function isVenueOpen(kind: VenueKind, time: Date): boolean {
  const hour = time.getUTCHours();
  const [opens, closes] = VENUE_HOURS[kind];
  return hour >= opens && hour < closes;
}
export function restoredEnergy(current: number, kinds: readonly string[]): number {
  const drink = kinds.includes('drink');
  const food = kinds.includes('food');
  return Math.min(100, current + (drink && food ? 80 : food ? 50 : drink ? 20 : 0));
}
export const lifeStateSchema = z.object({
  energy: z.number().int().min(0).max(100), coins: z.number().int().nonnegative(),
  gameTime: z.string().datetime(), serverTime: z.string().datetime(),
  appearance: appearanceSchema, ownedShirts: z.array(z.string()),
}).strict();
export type LifeState = z.infer<typeof lifeStateSchema>;
export const lifeActionSchema = z.object({ key: z.string().uuid() }).strict();
export const purchaseSchema = lifeActionSchema.extend({
  itemIds: z.array(z.string().regex(/^[a-z][a-z0-9_]*$/)).min(1).max(2)
    .refine(ids => new Set(ids).size === ids.length, 'Select distinct items'),
}).strict();
export const customizeSchema = lifeActionSchema.extend({
  hair: appearanceSchema.shape.hair.optional(),
  trousers: appearanceSchema.shape.trousers.optional(),
  shirtItemId: z.string().regex(/^[a-z][a-z0-9_]*$/).optional(),
}).strict().refine(body => body.hair !== undefined || body.trousers !== undefined || body.shirtItemId !== undefined,
  'Select at least one appearance change');
export type PurchaseRequest = z.infer<typeof purchaseSchema>;
export type CustomizeRequest = z.infer<typeof customizeSchema>;
