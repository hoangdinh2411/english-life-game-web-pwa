import type Phaser from 'phaser';
import type { MapPack } from '@life-abroad/shared';
import { packActorsSchema, packAnimationsSchema } from '@life-abroad/shared';
import { packKey } from './map-pack';
import { isServiceNpc, SHOP_NPCS } from '../shops/shop-npcs';
import { findStreetNpc, STREET_NPCS } from '../npcs/street-npcs';
import { venueNpcConfigForMapId } from '../shops/venue-npc-config';
import { VENUE_EXCLUSION_ZONES, VENUE_SPAWN_ZONES } from '../shops/venue-npc-config';
import { ambientNpcSpawnPoints } from '../npcs/controlled-presence';
import { NPC_DISPLAY_SCALE } from '../npcs/actor-display';

type Diagnostic = (message: string) => void;

function ambientNpcForAsset(pack: MapPack, asset: MapPack['assets'][number]): string | undefined {
  const config = venueNpcConfigForMapId(pack.mapId);
  return config?.ambientNpcPool.find(id =>
    asset.key === `npc-${id}` || asset.key === `npc-${id}-atlas` || asset.key === `portrait-${id}`,
  );
}

function optionalAmbientDiagnostic(npcId: string, mapId: string): string {
  return `Optional ambient NPC asset unavailable: ${npcId} at ${mapId}.`;
}

export function isDeferredStreetNpcAsset(pack: MapPack, asset: MapPack['assets'][number]): boolean {
  return pack.mapId === 'loc_town_street'
    && (asset.type === 'audio' && asset.key.startsWith('street-voice-')
      || asset.type === 'json' && asset.key === 'street-voices'
      || asset.key.startsWith('street-npcs-')
        && (asset.type === 'image' || (asset.type === 'json' && asset.key.endsWith('-atlas'))));
}

export function isBundledServiceAsset(asset: MapPack['assets'][number]): boolean {
  return SHOP_NPCS.some(npc => isServiceNpc(npc.id) && (
    asset.key === `npc-${npc.id}` || asset.key === `npc-${npc.id}-atlas` || asset.key === `portrait-${npc.id}`
  ));
}

export function loadPack(
  scene: Phaser.Scene,
  pack: MapPack,
  progress: (value: number) => void,
  signal: AbortSignal,
  diagnostic: Diagnostic = console.warn,
): Promise<ReadonlySet<string>> {
  return new Promise((resolve, reject) => {
    let failed = false;
    const unavailableAmbientNpcIds = new Set<string>();
    const optionalByLoaderKey = new Map(pack.assets.flatMap(asset => {
      const npcId = ambientNpcForAsset(pack, asset);
      return npcId ? [[packKey(pack, asset), npcId] as const] : [];
    }));
    const error = (file?: { key?: string }) => {
      const npcId = file?.key ? optionalByLoaderKey.get(file.key) : undefined;
      if (!npcId) { failed = true; return; }
      if (!unavailableAmbientNpcIds.has(npcId)) diagnostic(optionalAmbientDiagnostic(npcId, pack.mapId));
      unavailableAmbientNpcIds.add(npcId);
    };
    const cleanup = () => {
      scene.load.off('progress', progress);
      scene.load.off('loaderror', error);
      scene.load.off('complete', complete);
      signal.removeEventListener('abort', abort);
    };
    const abort = () => { cleanup(); scene.load.reset(); reject(new Error('Map download cancelled.')); };
    const complete = () => {
      cleanup();
      if (failed) reject(new Error('Map download failed. Reconnect and retry.'));
      else resolve(unavailableAmbientNpcIds);
    };
    if (signal.aborted) { reject(new Error('Map download cancelled.')); return; }
    signal.addEventListener('abort', abort, { once: true });
    scene.load.on('progress', progress);
    scene.load.on('loaderror', error);
    scene.load.once('complete', complete);
    for (const asset of pack.assets) {
      if (isDeferredStreetNpcAsset(pack, asset) || isBundledServiceAsset(asset)) continue;
      const key = packKey(pack, asset);
      const atlas = asset.type === 'image' ? pack.assets.find(item =>
        item.type === 'json' && item.key === `${asset.key}-atlas` && item.npcId === asset.npcId && item.version === asset.version) : undefined;
      if (asset.type === 'audio') scene.load.audio(key, asset.url);
      else if (asset.type === 'json' || asset.type === 'animation') scene.load.json(key, asset.url);
      else if (asset.type === 'spritesheet') scene.load.spritesheet(key, asset.url, { frameWidth: 32, frameHeight: 48 });
      else if (atlas) scene.load.atlas(key, asset.url, atlas.url);
      else scene.load.image(key, asset.url);
    }
    scene.load.start();
  });
}

export function preparePack(
  scene: Phaser.Scene,
  pack: MapPack,
  serviceTexture: (npcId: string) => string | undefined = () => undefined,
  unavailableAmbientNpcIds: ReadonlySet<string> = new Set(),
  diagnostic: Diagnostic = console.warn,
) {
  const background = pack.assets.find((asset) => asset.type === 'map' && asset.npcId === null);
  const player = pack.assets.find((asset) => asset.key === 'player' && asset.type === 'spritesheet' && asset.npcId === null);
  const playerAnimations = pack.assets.find((asset) => asset.type === 'animation' && asset.npcId === null);
  if (!background || !player || !playerAnimations) throw new Error('Map pack needs a background, player spritesheet and animations.');
  const definitions: { key: string; frames: { key: string; frame: number }[]; frameRate: number; repeat: number }[] = [];
  for (const asset of pack.assets.filter((item) => item.type === 'animation')) {
    const data = packAnimationsSchema.parse(scene.cache.json.get(packKey(pack, asset)));
    for (const animation of data.animations) {
      const texture = pack.assets.find((item) => item.key === animation.texture && item.npcId === asset.npcId && item.type === 'spritesheet');
      if (!texture) throw new Error('Animation texture is missing from this pack.');
      const key = `${packKey(pack, asset)}:${animation.key}`;
      const textureKey = packKey(pack, texture);
      if (animation.frames.some((frame) => !scene.textures.get(textureKey).has(String(frame)))) throw new Error('Animation frame is missing from this pack.');
      definitions.push({ key, frames: animation.frames.map((frame) => ({ key: textureKey, frame })), frameRate: animation.frameRate, repeat: animation.repeat });
    }
  }
  const walkPrefix = `${packKey(pack, playerAnimations)}:walk`;
  const animationKeys = definitions.map((definition) => definition.key);
  if ([0, 1, 2, 3].some((row) => !animationKeys.includes(`${walkPrefix}-${row}`))) {
    throw new Error('Map pack needs all four player walking animations.');
  }
  for (const definition of definitions) scene.anims.create(definition);
  const actorAsset = pack.assets.find(asset => asset.key === 'actors' && asset.type === 'json' && asset.npcId === null);
  const shop = pack.mapId === 'loc_cafe' || pack.mapId === 'loc_corner_cafe' || pack.mapId === 'loc_clothes';
  if (shop && !actorAsset) throw new Error('Shop NPC assets are missing. Please retry after the map upload finishes.');
  const authoredActors = actorAsset ? packActorsSchema.parse(scene.cache.json.get(packKey(pack, actorAsset))).actors : [];
  const venueConfig = venueNpcConfigForMapId(pack.mapId);
  if (venueConfig) {
    for (const npcId of [...venueConfig.serviceNpcIds, ...venueConfig.optionalStaffNpcIds]) {
      if (!authoredActors.some(actor => actor.npcId === npcId)) throw new Error(`Required service NPC ${npcId} definition is missing.`);
    }
  }
  const diagnosedAmbientNpcIds = new Set(unavailableAmbientNpcIds);
  const diagnoseAmbient = (npcId: string) => {
    if (!diagnosedAmbientNpcIds.has(npcId)) diagnostic(optionalAmbientDiagnostic(npcId, pack.mapId));
    diagnosedAmbientNpcIds.add(npcId);
  };
  const ambientSpawns = venueConfig ? ambientNpcSpawnPoints(
    venueConfig,
    VENUE_SPAWN_ZONES,
    VENUE_EXCLUSION_ZONES,
    authoredActors.flatMap(actor => actor.npcId ? [actor.npcId] : []),
    diagnostic,
  ) : new Map<string, { x: number; y: number }>();
  const actors = authoredActors.flatMap(actor => {
    const streetNpc = pack.mapId === 'loc_town_street' && actor.npcId ? findStreetNpc(actor.npcId) : undefined;
    const definition = streetNpc ?? (actor.npcId ? SHOP_NPCS.find(npc => npc.id === actor.npcId) : SHOP_NPCS.find(npc => npc.frame === actor.frame));
    if (!definition || definition.frame !== actor.frame) throw new Error('Shop NPC identity or atlas frame is invalid.');
    const ambient = venueConfig?.ambientNpcPool.includes(definition.id) ?? false;
    if (ambient && unavailableAmbientNpcIds.has(definition.id)) return [];
    if (ambient && !ambientSpawns.has(definition.id)) {
      diagnostic(`Optional ambient NPC spawn unavailable: ${definition.id} at ${pack.mapId}.`);
      return [];
    }
    const bundledTexture = actor.npcId ? serviceTexture(actor.npcId) : undefined;
    const texture = bundledTexture ? undefined : pack.assets.find(asset => asset.key === actor.texture && asset.type === 'image' && asset.npcId === null);
    const atlas = texture && pack.assets.find(asset => asset.key === `${texture.key}-atlas` && asset.type === 'json' && asset.npcId === texture.npcId && asset.version === texture.version);
    if (!bundledTexture && (!texture || (streetNpc && !atlas))) {
      if (ambient) { diagnoseAmbient(definition.id); return []; }
      throw new Error(`Required service NPC ${definition.id} asset is unavailable.`);
    }
    if (!streetNpc) {
      const textureKey = bundledTexture ?? packKey(pack, texture!);
      const textureFrames = scene.textures.get(textureKey);
      const missingFrame = !textureFrames.has(actor.frame) || shop && Array.from({ length: 16 }, (_, index) => `${actor.frame}-${Math.floor(index / 4)}-${index % 4}`)
        .some(frame => !textureFrames.has(frame));
      if (missingFrame) {
        if (ambient) { diagnoseAmbient(definition.id); return []; }
        if (venueConfig?.serviceNpcIds.includes(definition.id) || venueConfig?.optionalStaffNpcIds.includes(definition.id)) {
          throw new Error(`Required service NPC ${definition.id} asset is unavailable.`);
        }
        throw new Error('Shop NPC walking frames are missing. Please retry after the map upload finishes.');
      }
    }
    return [{
      ...actor,
      ...ambientSpawns.get(definition.id),
      npcId: definition.id,
      texture: bundledTexture ?? packKey(pack, texture!),
      scale: NPC_DISPLAY_SCALE,
    }];
  });
  if (pack.mapId === 'loc_town_street' && actors.length !== STREET_NPCS.length) throw new Error(`Town Street needs ${STREET_NPCS.length} configured resident NPC assets.`);
  return { background: packKey(pack, background), player: packKey(pack, player), walkPrefix, animationKeys, actors };
}
