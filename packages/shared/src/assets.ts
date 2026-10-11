import { z } from 'zod';

export const assetIdSchema = z.string().regex(/^[a-z][a-z0-9_-]{0,79}$/);
export const assetTypeSchema = z.enum(['map', 'image', 'audio', 'spritesheet', 'json', 'animation']);
export const assetUploadSchema = z.object({
  mapId: assetIdSchema.optional(), npcId: assetIdSchema.optional(),
  type: assetTypeSchema, version: z.coerce.number().int().positive().max(2147483647),
}).strict().refine((value) => value.mapId || value.npcId, 'A map or NPC is required');
export const mapAssetSchema = z.object({
  key: assetIdSchema, type: assetTypeSchema, version: z.number().int().positive(),
  url: z.string().url(), bytes: z.number().int().positive(), npcId: assetIdSchema.nullable(),
});
export const mapPackSchema = z.object({ mapId: assetIdSchema, assets: z.array(mapAssetSchema).min(1) });
export type MapAsset = z.infer<typeof mapAssetSchema>;
export type MapPack = z.infer<typeof mapPackSchema>;
export type AssetUpload = z.infer<typeof assetUploadSchema>;
export const packActorsSchema = z.object({ actors: z.array(z.object({
  texture: assetIdSchema, frame: assetIdSchema,
  x: z.number().min(0).max(1536), y: z.number().min(0).max(1024),
  scale: z.number().positive().max(2),
}).strict()).max(32) }).strict();
export const packAnimationsSchema = z.object({ animations: z.array(z.object({
  key: assetIdSchema, texture: assetIdSchema, frames: z.array(z.number().int().min(0).max(255)).min(1).max(256),
  frameRate: z.number().positive().max(60), repeat: z.number().int().min(-1).max(100),
})).max(100) });
