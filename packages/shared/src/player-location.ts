import { z } from 'zod';

export const playerMapIdSchema = z.enum(['loc_station', 'loc_town_street']);
export const playerPlaceIdSchema = z.enum([
  'loc_station', 'loc_town_street', 'loc_cafe', 'loc_corner_cafe', 'loc_clothes', 'loc_tax_office',
]);

export const playerLocationSchema = z.object({
  mapId: playerMapIdSchema,
  placeId: playerPlaceIdSchema,
  x: z.number().finite().min(0),
  y: z.number().finite().min(0),
}).strict().refine(({ mapId, placeId }) => (
  mapId === 'loc_station'
    ? placeId === 'loc_station' || placeId === 'loc_cafe' || placeId === 'loc_clothes'
    : placeId === 'loc_town_street' || placeId === 'loc_corner_cafe' || placeId === 'loc_tax_office'
), { message: 'Place does not belong to the selected map', path: ['placeId'] })
  .refine(({ mapId, x, y }) => mapId === 'loc_town_street' ? x <= 2304 && y <= 1536 : x <= 1536 && y <= 1024,
    { message: 'Position is outside the selected map', path: ['x'] });

export type PlayerLocation = z.infer<typeof playerLocationSchema>;
