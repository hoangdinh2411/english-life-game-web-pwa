import type Phaser from 'phaser';
import type { MapPack } from '@life-abroad/shared';
import { packActorsSchema, packAnimationsSchema } from '@life-abroad/shared';
import { packKey } from './map-pack';
import { SHOP_NPCS } from '../shops/shop-npcs';
import { findStreetNpc, STREET_NPCS } from '../npcs/street-npcs';

export function isDeferredStreetNpcAsset(pack: MapPack, asset: MapPack['assets'][number]): boolean {
  return pack.mapId === 'loc_town_street'
    && (asset.type === 'audio' && asset.key.startsWith('street-voice-')
      || asset.type === 'json' && asset.key === 'street-voices'
      || asset.key.startsWith('street-npcs-')
        && (asset.type === 'image' || (asset.type === 'json' && asset.key.endsWith('-atlas'))));
}

export function loadPack(scene: Phaser.Scene, pack: MapPack, progress: (value: number) => void, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    let failed = false;
    const error = () => { failed = true; };
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
      else resolve();
    };
    if (signal.aborted) { reject(new Error('Map download cancelled.')); return; }
    signal.addEventListener('abort', abort, { once: true });
    scene.load.on('progress', progress);
    scene.load.on('loaderror', error);
    scene.load.once('complete', complete);
    for (const asset of pack.assets) {
      if (isDeferredStreetNpcAsset(pack, asset)) continue;
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

export function preparePack(scene: Phaser.Scene, pack: MapPack) {
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
  const actors = actorAsset ? packActorsSchema.parse(scene.cache.json.get(packKey(pack, actorAsset))).actors.map(actor => {
    const streetNpc = pack.mapId === 'loc_town_street' && actor.npcId ? findStreetNpc(actor.npcId) : undefined;
    const definition = streetNpc ?? (actor.npcId ? SHOP_NPCS.find(npc => npc.id === actor.npcId) : SHOP_NPCS.find(npc => npc.frame === actor.frame));
    if (!definition || definition.frame !== actor.frame) throw new Error('Shop NPC identity or atlas frame is invalid.');
    const texture = pack.assets.find(asset => asset.key === actor.texture && asset.type === 'image' && asset.npcId === null);
    const atlas = texture && pack.assets.find(asset => asset.key === `${texture.key}-atlas` && asset.type === 'json' && asset.npcId === texture.npcId && asset.version === texture.version);
    if (!texture || (streetNpc && !atlas)) throw new Error('NPC atlas is missing from this pack.');
    if (!streetNpc) {
      const textureKey = packKey(pack, texture);
      if (!scene.textures.get(textureKey).has(actor.frame)) throw new Error('NPC atlas frame is missing from this pack.');
      if (shop && Array.from({ length: 16 }, (_, index) => `${actor.frame}-${Math.floor(index / 4)}-${index % 4}`)
        .some(frame => !scene.textures.get(textureKey).has(frame))) throw new Error('Shop NPC walking frames are missing. Please retry after the map upload finishes.');
    }
    return { ...actor, npcId: definition.id, texture: packKey(pack, texture) };
  }) : [];
  const expectedActors = pack.mapId === 'loc_corner_cafe' ? 5 : shop ? 3 : null;
  if (expectedActors !== null && actors.length !== expectedActors) throw new Error(`Shop map needs ${expectedActors} configured NPC assets.`);
  if (pack.mapId === 'loc_town_street' && actors.length !== STREET_NPCS.length) throw new Error(`Town Street needs ${STREET_NPCS.length} configured resident NPC assets.`);
  return { background: packKey(pack, background), player: packKey(pack, player), walkPrefix, animationKeys, actors };
}
