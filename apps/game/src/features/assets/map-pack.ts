import { mapPackSchema, type MapAsset, type MapPack } from '@life-abroad/shared';

export function packKey(pack: MapPack, asset: MapAsset): string {
  return `pack:${pack.mapId}:${asset.npcId ?? 'map'}:${asset.key}:v${asset.version}`;
}
export async function fetchMapPack(mapId: string, signal: AbortSignal): Promise<MapPack> {
  if (!navigator.onLine) throw new Error('You’re offline. Only station practice is available. Reconnect and retry.');
  const baseUrl = import.meta.env?.VITE_API_URL ?? 'http://localhost:3000/api/v1';
  const response = await fetch(`${baseUrl}/content/maps/${encodeURIComponent(mapId)}`, { cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]) });
  if (!response.ok) throw new Error('This map is unavailable. Reconnect and retry.');
  const pack = mapPackSchema.parse(await response.json());
  if (pack.mapId !== mapId || !pack.assets.some((asset) => asset.type === 'map')) throw new Error('Invalid map pack.');
  return pack;
}

export interface PackCaches {
  textures: { remove(key: string): unknown };
  cache: { audio: { remove(key: string): unknown }; json: { remove(key: string): unknown } };
  anims: { remove(key: string): unknown };
  sound: { removeByKey(key: string): unknown };
}
// Called after scene shutdown has destroyed sprites, sounds and animation users.
export function unloadPack(pack: MapPack, caches: PackCaches, animations: readonly string[]): void {
  for (const key of animations) caches.anims.remove(key);
  for (const asset of pack.assets) {
    const key = packKey(pack, asset);
    if (asset.type === 'audio') { caches.sound.removeByKey(key); caches.cache.audio.remove(key); }
    else if (asset.type === 'json' || asset.type === 'animation') caches.cache.json.remove(key);
    else caches.textures.remove(key);
  }
}
