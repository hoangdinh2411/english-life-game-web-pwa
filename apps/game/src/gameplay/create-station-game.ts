import type { MapLocation, Point, StationCallbacks, StationGame, StationPortal } from '../types/gameplay/world';
import Phaser from 'phaser';
import { stationAtlases, stationBackground } from './station-assets';
import type { MapAsset, MapPack } from '@life-abroad/shared';
import { paintPlayerTexture } from '../features/appearance/player-texture';
import { fetchMapPack, packKey, unloadPack } from '../features/assets/map-pack';
import { isDeferredStreetNpcAsset, loadPack, preparePack } from '../features/assets/phaser-pack';
import { authorizeStreetExit, canWalk, canWalkStreet, CORNER_CUP_LABEL_POSITION, CORNER_CUP_PORTAL, findPath, moveOnStreet, movePlayer, movementDelta, nearestNpc, portalAt, scaleStreetPoint, streetSpawnPoint, STREET_MAP_SCALE, STREET_MAP_SIZE, STATION_NPCS, STATION_PORTALS } from './station-navigation';
import { SHOP_NPCS } from '../features/shops/shop-npcs';
import { findStreetNpc, STREET_NPC_ROUTES } from '../features/npcs/street-npcs';
import { canEnterLocation, moveInShop, shopCanWalk } from '../features/shops/shop-navigation';
import { updateNpcActors, type NpcActor } from '../features/npcs/npc-actors';
import { npcNeedsTalk } from './arrival-hud';
const LOCATION_NAMES: Record<MapLocation, string> = { station: 'Maplewood · Train Station', cafe: 'Maplewood · Café', corner_cafe: 'Maplewood · Corner Cup Café', clothes: 'Maplewood · Clothes Shop', street: 'Maplewood · Town Street' };

export function createStationGame(parent: HTMLElement, callbacks: StationCallbacks): StationGame {
  let activeLocation: MapLocation = callbacks.initialLocation ?? 'station';
  let destroyed = false;
  let appearance = callbacks.practice ? undefined : callbacks.appearance;
  let refreshAppearance: (() => void) | undefined;
  let currentPack: MapPack | null = null;
  let packAnimations: string[] = [];
  let packRequest: AbortController | null = null;
  const mapIds = { street: 'loc_town_street', cafe: 'loc_cafe', corner_cafe: 'loc_corner_cafe', clothes: 'loc_clothes' };
  let authorizing = false;
  const P = Phaser;
  let paused = false;
  let worldPaused = false;
  let conversationNpcId: string | null = null;
  let exitUnlocked = false;
  let blockedPortal: string | null = null;
  let position: Point = activeLocation === 'street' ? streetSpawnPoint('station') : { x: 768, y: 370 };
  let destinationMapTarget: Point | null = null;
  let destination: Point | null = null;
  let route: Point[] = [];
  let selectedNpc: string | null = null;
  let nearby: string | null = null;
  let npcs = STATION_NPCS.map((npc) => ({ ...npc }));
  const talk = () => { const npc = nearestNpc(position, npcs); if (!paused && npc) callbacks.onTalk(npc.id); };
  class StationScene extends P.Scene {
    private player!: Phaser.GameObjects.Sprite;
    private marker!: Phaser.GameObjects.Arc;
    private keys: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
    private walkingKeys: Record<string, Phaser.Input.Keyboard.Key> = {};
    private labels: Phaser.GameObjects.Text[] = [];
    private npcActors: NpcActor[] = [];
    private npcArtQueue = new Map<string, { image: MapAsset; atlas: MapAsset }>();
    private npcArtLoading = false;
    private npcArtInFlight: string | null = null;
    private npcArtRetryAt = new Map<string, number>();
    private transitionPending = false;
    private worldReady = false;
    preload() {
      if (activeLocation === 'station') {
        this.load.image('station', stationBackground);
        for (const atlas of stationAtlases) if (!this.textures.exists(atlas.key)) this.load.atlas(atlas.key, atlas.url, atlas.data);
      }
      const onLoadError = () => callbacks.onError('Station artwork could not load. Please retry.');
      this.load.on('loaderror', onLoadError);
      this.events.once('shutdown', () => this.load.off('loaderror', onLoadError));
    }
    create() {
      refreshAppearance = () => { if (this.worldReady) this.applyAppearance(); };
      const stationOwned = activeLocation === 'station';
      this.events.once('shutdown', () => {
        this.worldReady = false;
        refreshAppearance = undefined;
        this.npcArtQueue.clear();
        this.npcArtRetryAt.clear();
        this.npcArtLoading = false;
        this.npcArtInFlight = null;
        for (const key of this.appearanceAnimations) this.anims.remove(key);
        this.appearanceAnimations = [];
        if (this.textures.exists('player:appearance')) this.textures.remove('player:appearance');
        packRequest?.abort();
        if (currentPack) { unloadPack(currentPack, this, packAnimations); currentPack = null; packAnimations = []; }
        if (stationOwned) {
          for (const atlas of stationAtlases) {
            for (let row = 0; row < 4; row++) this.anims.remove(atlas.key === 'player' ? `walk-${row}` : `${atlas.key}-walk-${row}`);
            this.textures.remove(atlas.key);
          }
          this.textures.remove('station');
        }
      });
      const updateTalkPrompt = () => this.updateTalkPrompt();
      this.game.events.on('postrender', updateTalkPrompt);
      this.events.once('shutdown', () => {
        this.game.events.off('postrender', updateTalkPrompt);
        callbacks.onTalkPrompt?.(null);
      });
      if (activeLocation === 'station') this.createWorld();
      else {
        packRequest = new AbortController();
        const signal = packRequest.signal;
        callbacks.onProgress(0);
        void fetchMapPack(mapIds[activeLocation], signal).then(async (pack) => {
          if (signal.aborted || destroyed) return;
          currentPack = pack;
          await loadPack(this, pack, callbacks.onProgress, signal);
          if (!signal.aborted && !destroyed) this.createWorld();
        }).catch((error: unknown) => {
          if (!signal.aborted && !destroyed) callbacks.onError(error instanceof Error ? error.message : 'Map download failed. Please retry.');
        });
      }
    }
    private createWorld() {
      const resources = currentPack ? preparePack(this, currentPack) : null;
      if (activeLocation === 'station' && (!this.textures.exists('station') || stationAtlases.some((atlas) => !this.textures.exists(atlas.key)))) return;
      this.playerTexture = resources?.player ?? 'player';
      this.walkPrefix = resources?.walkPrefix ?? 'walk';
      this.sourcePlayerTexture = this.playerTexture;
      this.sourceWalkPrefix = this.walkPrefix;
      packAnimations = resources?.animationKeys ?? [];
      this.transitionPending = false;
      this.labels = [];
      this.npcActors = [];
      npcs = activeLocation === 'station' ? STATION_NPCS.map(npc => ({ ...npc })) : [];
      const background = this.add.image(0, 0, resources?.background ?? 'station').setOrigin(0);
      if (activeLocation === 'street') background.setScale(STREET_MAP_SCALE);
      this.marker = this.add.circle(0, 0, 16, 0xf6df9e, 0.5).setStrokeStyle(3, 0x426f61).setVisible(false);
      // Station animation frames stay bundled; destination definitions come from Storage.
      if (!currentPack) for (let row = 0; row < 4; row++) {
        const key = `${this.walkPrefix}-${row}`;
        if (!this.anims.exists(key)) this.anims.create({ key, frames: Array.from({ length: 4 }, (_, column) => ({ key: this.playerTexture, frame: currentPack ? row * 4 + column : `${row}-${column}` })), frameRate: 7, repeat: -1 });
      }
      if (appearance) this.applyAppearance();
      for (const actor of resources?.actors ?? []) {
        const streetDefinition = activeLocation === 'street' && actor.npcId ? findStreetNpc(actor.npcId) : undefined;
        const definition = streetDefinition ?? SHOP_NPCS.find(npc => npc.id === actor.npcId) ?? SHOP_NPCS.find(npc => npc.frame === actor.frame);
        if (!definition) continue;
        const actorPosition = activeLocation === 'street' ? scaleStreetPoint(actor) : { x: actor.x, y: actor.y };
        const lazyStreetArt = activeLocation === 'street';
        const textureReady = this.textures.exists(actor.texture);
        const displayTexture = lazyStreetArt && !textureReady ? '__DEFAULT' : actor.texture;
        const displayFrame = lazyStreetArt && !textureReady ? '__BASE' : actor.frame;
        const sprite = this.add.sprite(actorPosition.x, actorPosition.y, displayTexture, displayFrame)
          .setOrigin(0.5, 1).setScale(actor.scale).setDepth(actorPosition.y).setVisible(!lazyStreetArt);
        const npc = { id: definition.id, name: definition.name, texture: actor.texture, x: actorPosition.x, y: actorPosition.y };
        npcs.push(npc);
        const labelText = definition.name;
        const label = this.add.text(npc.x, npc.y - 112, labelText, { fontFamily: 'sans-serif', fontSize: '24px', color: '#263630', backgroundColor: '#fff6df', padding: { x: 8, y: 5 } }).setOrigin(0.5, 1).setDepth(1500);
        label.setVisible(!lazyStreetArt);
        this.labels.push(label);
        const npcWalk = `${actor.texture}:${actor.frame}-walk`;
        if (textureReady) {
          for (let row = 0; row < 4; row++) {
            const key = `${npcWalk}-${row}`;
            if (!this.anims.exists(key)) this.anims.create({ key, frames: Array.from({ length: 4 }, (_, column) => ({ key: actor.texture, frame: `${actor.frame}-${row}-${column}` })), frameRate: 7, repeat: -1 });
            packAnimations.push(key);
          }
        }
        const authoredRoute = streetDefinition && STREET_NPC_ROUTES.find(route => route.id === streetDefinition.routeId);
        this.npcActors.push({ npc, anchor: { x: npc.x, y: npc.y }, sprite, label, elapsed: 0,
          idleFrame: textureReady ? actor.frame : '__BASE', ...(textureReady ? { walkPrefix: npcWalk } : {}),
          ...(lazyStreetArt ? { artTextureKey: actor.texture, artFrame: actor.frame } : {}), labelOffset: 105,
          ...(authoredRoute && streetDefinition && !streetDefinition.stationary ? { patrol: { points: authoredRoute.points.map(scaleStreetPoint), startWaypoint: streetDefinition.startWaypoint } } : {}),
          clip: (anchor, offset) => moveInShop(activeLocation, anchor, offset) });
        sprite.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
          if (paused) return;
          if (nearestNpc(position, [npc])) { callbacks.onTalk(npc.id); return; }
          selectedNpc = npc.id;
          destinationMapTarget = null;
          route = [];
          if (activeLocation === 'street') {
            const candidates = [
              { x: npc.x, y: npc.y + 55 }, { x: npc.x - 55, y: npc.y },
              { x: npc.x + 55, y: npc.y }, { x: npc.x, y: npc.y - 55 },
            ].filter(canWalkStreet);
            route = candidates.map(target => findPath(position, target, canWalkStreet, moveOnStreet)).find(path => path.length > 0) ?? [];
          } else {
            destinationMapTarget = { x: npc.x, y: npc.y + 55 };
            route = findPath(position, destinationMapTarget, point => shopCanWalk(activeLocation, point, npcs), (point, delta) => moveInShop(activeLocation, point, delta, npcs));
          }
          destinationMapTarget = route.shift() ?? null;
          if (!destinationMapTarget) { selectedNpc = null; return; }
          this.marker.setPosition(destinationMapTarget.x, destinationMapTarget.y).setVisible(true);
        });
      }
      if (currentPack) for (const asset of currentPack.assets.filter((item) => item.npcId && ['image', 'spritesheet'].includes(item.type))) {
        this.add.sprite(500 + currentPack.assets.indexOf(asset) * 80, 400, packKey(currentPack, asset), 0).setDepth(400);
      }
      if (activeLocation === 'station') for (const npc of npcs) {
        const shadow = this.add.ellipse(npc.x, npc.y - 3, 48, 16, 0x443728, 0.22);
        const sprite = this.add.sprite(npc.x, npc.y, npc.texture, '0-0').setOrigin(0.5, 1).setScale(2).setDepth(npc.y);
        for (const row of [0, 1, 2, 3]) if (!this.anims.exists(`${npc.texture}-walk-${row}`)) this.anims.create({ key: `${npc.texture}-walk-${row}`, frames: Array.from({ length: 4 }, (_, column) => ({ key: npc.texture, frame: `${row}-${column}` })), frameRate: 8, repeat: -1 });
        sprite.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
          if (paused) return;
          if (Math.hypot(position.x - npc.x, position.y - npc.y) <= 110) { callbacks.onTalk(npc.id); return; }
          selectedNpc = npc.id;
          const target = { x: npc.x, y: npc.y + 55 };
          route = findPath(position, target); destination = route.shift() ?? null;
          this.marker.setPosition(target.x, target.y).setVisible(true);
        });
        const name = npc.name;
        const needsTalk = npcNeedsTalk(npc.id);
        const label = this.add.text(npc.x, npc.y - 108, needsTalk ? `! ${name}` : name, { fontFamily: 'sans-serif', fontSize: '24px', fontStyle: needsTalk ? 'bold' : 'normal', color: '#263630', backgroundColor: needsTalk ? '#ffe08a' : '#fff6df', padding: { x: 8, y: 5 } }).setOrigin(0.5, 1).setDepth(1500);
        this.labels.push(label);
        this.npcActors.push({ npc, anchor: { x: npc.x, y: npc.y }, sprite, shadow, label, elapsed: 0, idleFrame: '0-0', walkPrefix: `${npc.texture}-walk`, labelOffset: 108, clip: movePlayer });
      }
      for (const portal of this.portalsForLocation()) this.addPortalRing(portal, portal.id !== 'corner_cafe');
      if (activeLocation === 'street') {
        this.add.text(CORNER_CUP_LABEL_POSITION.x, CORNER_CUP_LABEL_POSITION.y, 'CORNER CUP', {
          fontFamily: 'sans-serif', fontSize: '26px', fontStyle: 'bold', color: '#fff7e8',
          backgroundColor: '#315749', padding: { x: 14, y: 7 },
        }).setOrigin(0.5).setDepth(1500);
      }
      if (activeLocation === 'corner_cafe') this.add.text(768, 147, 'CORNER CUP', {
        fontFamily: 'sans-serif', fontSize: '32px', fontStyle: 'bold', color: '#fff7e8',
        backgroundColor: '#315749', padding: { x: 18, y: 8 },
      }).setOrigin(0.5).setDepth(1500);
      this.player = this.add.sprite(position.x, position.y, this.playerTexture, currentPack ? 0 : '0-0').setOrigin(0.5, 1).setScale(2);
      this.keys = this.input.keyboard?.createCursorKeys();
      if (this.input.keyboard) {
        // Do not capture browser input: the text composer must retain normal typing.
        this.walkingKeys = this.input.keyboard.addKeys('W,A,S,D', false) as Record<string, Phaser.Input.Keyboard.Key>;
        this.input.keyboard.clearCaptures();
        this.input.keyboard.on('keydown-E', talk);
        this.events.once('shutdown', () => this.input.keyboard?.off('keydown-E', talk));
      }
      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, objects: Phaser.GameObjects.GameObject[]) => {
        if (paused || objects.length) return;
        const target = { x: pointer.worldX, y: pointer.worldY };
        if (activeLocation !== 'station') {
          selectedNpc = null;
          const street = activeLocation === 'street';
          const walkable = street ? canWalkStreet(target) : shopCanWalk(activeLocation, target, npcs);
          if (walkable) {
            route = street
              ? findPath(position, target, canWalkStreet, moveOnStreet)
              : findPath(position, target, point => shopCanWalk(activeLocation, point, npcs), (point, delta) => moveInShop(activeLocation, point, delta, npcs));
            destinationMapTarget = route.shift() ?? null;
            if (destinationMapTarget) this.marker.setPosition(target.x, target.y).setVisible(true);
          } else {
            route = [];
            destinationMapTarget = null;
            this.marker.setVisible(false);
          }
        } else if (canWalk(target)) { route = findPath(position, target); destination = route.shift() ?? null; selectedNpc = null; this.marker.setPosition(target.x, target.y).setVisible(true); }
      });
      const resizeLabels = () => {
        const zoom = Math.max(this.scale.width / 1536, this.scale.height / 1024);
        this.cameras.main.setZoom(zoom);
        for (const label of this.labels) label.setFontSize(Math.round(13 / zoom));
      };
      const mapSize = activeLocation === 'street' ? STREET_MAP_SIZE : { width: 1536, height: 1024 };
      this.cameras.main.setBounds(0, 0, mapSize.width, mapSize.height).startFollow(this.player, false, 0.12, 0.12);
      resizeLabels();
      this.scale.on('resize', resizeLabels);
      this.events.once('shutdown', () => this.scale.off('resize', resizeLabels));
      callbacks.onLocationChange(LOCATION_NAMES[activeLocation]);
      this.worldReady = true;
      callbacks.onReady();
    }
    private updateTalkPrompt() {
      if (!callbacks.onTalkPrompt) return;
      const npc = this.worldReady && !paused && !authorizing ? nearestNpc(position, npcs) : null;
      const actor = npc && this.npcActors.find(candidate => candidate.npc.id === npc.id);
      if (!actor || !actor.sprite.visible || !actor.label.visible) {
        callbacks.onTalkPrompt(null);
        return;
      }
      const camera = this.cameras.main;
      const top = actor.label.getTopCenter();
      const x = Math.round((top.x - camera.worldView.x) * camera.zoom + camera.x);
      const y = Math.round((top.y - camera.worldView.y) * camera.zoom + camera.y - 6);
      // Keep the full touch target inside the canvas, above the name label.
      if (x < 30 || x > this.scale.width - 30 || y < 44 || y > this.scale.height) {
        callbacks.onTalkPrompt(null);
        return;
      }
      callbacks.onTalkPrompt({ npcId: actor.npc.id, name: actor.npc.name, x, y });
    }
    private addPortalRing(portal: StationPortal, showLabel = true) {
      const halo = this.add.circle(portal.x, portal.y, 34, 0x73dfa0, 0.3).setStrokeStyle(4, 0x9cffbd, 0.85).setDepth(5);
      this.add.circle(portal.x, portal.y, 22, 0xc3ffd5, 0.14).setStrokeStyle(2, 0xd3ffe0, 0.75).setDepth(5);
      if (showLabel) this.add.text(portal.x, portal.y - 42, portal.label, { fontFamily: 'sans-serif', fontSize: '22px', color: '#263630', backgroundColor: '#fff6df', padding: { x: 8, y: 5 } }).setOrigin(0.5, 1).setDepth(1500);
      this.tweens.add({ targets: halo, scale: 1.2, alpha: 0.72, duration: 750, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    private portalsForLocation(): StationPortal[] {
      if (activeLocation === 'station') return STATION_PORTALS;
      if (activeLocation === 'street') return [
        CORNER_CUP_PORTAL,
        { id: 'station', label: 'Train Station', ...scaleStreetPoint({ x: 768, y: 130 }) },
      ];
      const destination: MapLocation = this.previousLocation === 'street' ? 'street' : 'station';
      return [{ id: destination, label: destination === 'street' ? 'Town Street' : 'Train Station', x: 768, y: 930 }];
    }
    private enterLocation(location: MapLocation, streetArrival: 'station' | 'corner_cafe' = 'station') {
      if (this.transitionPending) return;
      if (callbacks.getGameTime && !canEnterLocation(location, callbacks.getGameTime())) {
        const portal = portalAt(position, this.portalsForLocation());
        if (portal) position = activeLocation === 'street'
          ? streetSpawnPoint('corner_cafe')
          : { x: portal.x, y: portal.y + 55 };
        destinationMapTarget = null;
        route = [];
        selectedNpc = null;
        this.marker?.setVisible(false);
        this.player?.setPosition(position.x, position.y).anims.stop();
        if (location === 'cafe' || location === 'corner_cafe' || location === 'clothes') {
          callbacks.onStoreClosed?.(location);
        }
        return;
      }
      if (callbacks.practice && location !== 'station') {
        callbacks.onError('Local practice stays in the station. Sign in to visit other maps.');
        position = { x: 768, y: 370 };
        return;
      }
      this.transitionPending = true;
      activeLocation = location;
      destinationMapTarget = null;
      route = [];
      selectedNpc = null;
      nearby = null;
      if (location === 'station') {
        const portal = STATION_PORTALS.find((item) => item.id === this.previousLocation);
        position = portal ? { x: portal.x + (portal.id === 'cafe' ? 70 : portal.id === 'clothes' ? -70 : 0), y: portal.id === 'street' ? 850 : 750 } : { x: 768, y: 370 };
      } else if (location === 'street') position = streetSpawnPoint(streetArrival);
      else position = { x: 768, y: 860 };
      callbacks.onLocationChange(LOCATION_NAMES[location]);
      this.worldReady = false;
      this.scene.restart();
    }
    private ensureVisibleStreetNpcArt() {
      this.npcArtQueue.clear();
      for (const actor of this.npcActors) {
        if (!actor.artTextureKey || !actor.artFrame) continue;
        const inView = this.cameras.main.worldView.contains(actor.npc.x, actor.npc.y);
        const visible = inView && actor.walkPrefix !== undefined;
        actor.sprite.setVisible(visible);
        actor.label.setVisible(visible);
        if (!inView) continue;
        const retryAt = this.npcArtRetryAt.get(actor.artTextureKey) ?? 0;
        if (retryAt > Date.now()) continue;
        this.npcArtRetryAt.delete(actor.artTextureKey);
        this.queueStreetNpcArt(actor.artTextureKey);
      }
      this.loadNextStreetNpcArt();
    }
    private queueStreetNpcArt(textureKey: string) {
      if (!currentPack || this.textures.exists(textureKey) || textureKey === this.npcArtInFlight || this.npcArtQueue.has(textureKey)) return;
      const image = currentPack.assets.find(asset => asset.type === 'image' && packKey(currentPack!, asset) === textureKey);
      const atlas = image && currentPack.assets.find(asset => asset.type === 'json' && asset.key === `${image.key}-atlas` && asset.npcId === image.npcId && asset.version === image.version);
      if (!image || !atlas || !isDeferredStreetNpcAsset(currentPack, image)) return;
      this.npcArtQueue.set(textureKey, { image, atlas });
    }
    private loadNextStreetNpcArt() {
      if (this.npcArtLoading || !currentPack || !this.npcArtQueue.size) return;
      const next = this.npcArtQueue.entries().next().value as [string, { image: MapAsset; atlas: MapAsset }] | undefined;
      if (!next) return;
      const [textureKey, { image, atlas }] = next;
      this.npcArtQueue.delete(textureKey);
      const signal = packRequest?.signal;
      if (!signal || signal.aborted) return;
      this.npcArtLoading = true;
      this.npcArtInFlight = textureKey;
      const cleanup = () => {
        this.load.off('complete', complete);
        signal.removeEventListener('abort', abort);
      };
      const abort = () => {
        cleanup();
        this.load.reset();
        this.npcArtQueue.clear();
        this.npcArtLoading = false;
        this.npcArtInFlight = null;
      };
      const complete = () => {
        cleanup();
        this.npcArtLoading = false;
        this.npcArtInFlight = null;
        if (signal.aborted) return;
        const actors = this.npcActors.filter(actor => actor.artTextureKey === textureKey && actor.artFrame);
        const textureLoaded = this.textures.exists(textureKey);
        const framesValid = textureLoaded && actors.every(actor => {
          const frame = actor.artFrame!;
          const texture = this.textures.get(textureKey);
          return texture.has(frame) && Array.from({ length: 16 }, (_, index) => `${frame}-${Math.floor(index / 4)}-${index % 4}`).every(name => texture.has(name));
        });
        if (framesValid) {
          for (const actor of actors) {
            const frame = actor.artFrame!;
            const walkPrefix = `${textureKey}:${frame}-walk`;
            for (let row = 0; row < 4; row++) {
              const key = `${walkPrefix}-${row}`;
              if (!this.anims.exists(key)) {
                this.anims.create({ key, frames: Array.from({ length: 4 }, (_, column) => ({ key: textureKey, frame: `${frame}-${row}-${column}` })), frameRate: 7, repeat: -1 });
                packAnimations.push(key);
              }
            }
            actor.sprite.anims.stop();
            actor.sprite.setTexture(textureKey, frame);
            actor.idleFrame = frame;
            actor.walkPrefix = walkPrefix;
          }
        } else {
          if (textureLoaded) this.textures.remove(textureKey);
          this.npcArtRetryAt.set(textureKey, Date.now() + 5000);
        }
        this.ensureVisibleStreetNpcArt();
      };
      signal.addEventListener('abort', abort, { once: true });
      this.load.once('complete', complete);
      this.load.atlas(textureKey, image.url, atlas.url);
      this.load.start();
    }
    private previousLocation: MapLocation = 'station';
    private playerTexture = 'player';
    private walkPrefix = 'walk';
    private sourcePlayerTexture = 'player';
    private sourceWalkPrefix = 'walk';
    private appearanceAnimations: string[] = [];
    applyAppearance() {
      if (!this.textures.exists(this.sourcePlayerTexture)) return;
      this.playerTexture = paintPlayerTexture(this, this.sourcePlayerTexture, 'player:appearance', appearance, false);
      for (let row = 0; row < 4; row++) {
        const key = `appearance:walk-${row}`;
        if (!this.anims.exists(key)) {
          const original = this.anims.get(`${this.sourceWalkPrefix}-${row}`);
          if (!original) continue;
          this.anims.create({ key, frames: original.frames.map(frame => ({ key: this.playerTexture, frame: frame.textureFrame })), frameRate: original.frameRate, repeat: original.repeat });
          this.appearanceAnimations.push(key);
        }
      }
      this.walkPrefix = 'appearance:walk';
      if (this.worldReady && this.player) {
        const frame = this.player.frame.name;
        this.player.anims.stop();
        this.player.setTexture(this.playerTexture, frame);
      }
    }
    private updateDestination(delta: number) {
      if (paused) { destinationMapTarget = null; route = []; selectedNpc = null; this.marker.setVisible(false); this.player.anims.stop(); return; }
      const x = Number(this.keys?.right.isDown || this.walkingKeys.D?.isDown) - Number(this.keys?.left.isDown || this.walkingKeys.A?.isDown);
      const y = Number(this.keys?.down.isDown || this.walkingKeys.S?.isDown) - Number(this.keys?.up.isDown || this.walkingKeys.W?.isDown);
      let dx = x, dy = y;
      if (x || y) { destinationMapTarget = null; route = []; selectedNpc = null; }
      else if (destinationMapTarget) { dx = destinationMapTarget.x - position.x; dy = destinationMapTarget.y - position.y; }
      const movement = movementDelta({ x: dx, y: dy }, 215 * Math.min(delta, 50) / 1000, Boolean(x || y));
      const previous = position;
      position = activeLocation === 'street'
        ? moveOnStreet(position, movement)
        : moveInShop(activeLocation, position, movement, npcs);
      const moved = Math.hypot(position.x - previous.x, position.y - previous.y) > 0.01;
      this.player.setPosition(position.x, position.y).setDepth(position.y);
      if (moved) this.player.play(`${this.walkPrefix}-${Math.abs(dx) > Math.abs(dy) ? dx < 0 ? 1 : 2 : dy < 0 ? 3 : 0}`, true);
      else this.player.anims.stop();
      const closest = nearestNpc(position, npcs)?.id ?? null;
      if (closest !== nearby) { nearby = closest; callbacks.onNearby(closest); }
      if (selectedNpc && closest === selectedNpc) {
        const id = selectedNpc; selectedNpc = null; destinationMapTarget = null;
        this.player.anims.stop(); this.marker.setVisible(false); callbacks.onTalk(id); return;
      }
      const portal = portalAt(position, this.portalsForLocation());
      if (portal) {
        if (portal.id === 'station' || portal.id === 'corner_cafe') this.previousLocation = activeLocation;
        this.enterLocation(portal.id as MapLocation, activeLocation === 'corner_cafe' ? 'corner_cafe' : 'station');
        return;
      }
      destinationMapTarget = destinationMapTarget && Math.hypot(destinationMapTarget.x - position.x, destinationMapTarget.y - position.y) > 3 ? destinationMapTarget : null;
      if (!destinationMapTarget && route.length) destinationMapTarget = route.shift() ?? null;
      if (!destinationMapTarget) this.marker.setVisible(false);
    }
    update(_time: number, delta: number) {
      if (!this.worldReady) return;
      if (authorizing) { this.player.anims.stop(); return; }
      updateNpcActors(this.npcActors, position, delta, worldPaused, conversationNpcId);
      if (activeLocation === 'street') this.ensureVisibleStreetNpcArt();
      if (activeLocation !== 'station') { this.updateDestination(delta); return; }
      if (paused) { destination = null; route = []; selectedNpc = null; this.player.anims.stop(); this.marker.setVisible(false); return; }
      const x = Number(this.keys?.right.isDown || this.walkingKeys.D?.isDown) - Number(this.keys?.left.isDown || this.walkingKeys.A?.isDown);
      const y = Number(this.keys?.down.isDown || this.walkingKeys.S?.isDown) - Number(this.keys?.up.isDown || this.walkingKeys.W?.isDown);
      const speed = 215 * Math.min(delta, 50) / 1000;
      let dx = x, dy = y;
      if (dx || dy) { destination = null; route = []; selectedNpc = null; }
      else if (destination) { dx = destination.x - position.x; dy = destination.y - position.y; }
      const movement = movementDelta({ x: dx, y: dy }, speed, Boolean(x || y));
      if (movement.x || movement.y) {
        const next = movePlayer(position, movement);
        const moved = Math.hypot(next.x - position.x, next.y - position.y) > 0.01;
        position = next;
        this.player.setPosition(position.x, position.y).setDepth(position.y);
        if (moved) this.player.play(`${this.walkPrefix}-${Math.abs(dx) > Math.abs(dy) ? dx < 0 ? 1 : 2 : dy < 0 ? 3 : 0}`, true);
        else { destination = null; selectedNpc = null; this.player.anims.stop(); }
      } else {
        if (route.length) { destination = route.shift() ?? null; return; }
        this.player.anims.stop();
        if (selectedNpc) { const id = selectedNpc; selectedNpc = null; if (nearestNpc(position, npcs)?.id === id) callbacks.onTalk(id); }
        destination = null;
        this.marker.setVisible(false);
      }
      const id = nearestNpc(position, npcs)?.id ?? null;
      if (id !== nearby) { nearby = id; callbacks.onNearby(id); }
      const portal = portalAt(position, STATION_PORTALS);
      if (portal?.id === 'street' && !exitUnlocked) {
        if (blockedPortal !== portal.id) callbacks.onExitBlocked();
        blockedPortal = portal.id;
        destination = null; route = []; selectedNpc = null;
        return;
      }
      blockedPortal = null;
      if (portal?.id === 'street' && callbacks.onEnterStreet) {
        authorizing = true;
        destination = null; route = []; selectedNpc = null;
        // Move outside the ring so a failed request needs a deliberate retry.
        position = { x: portal.x, y: portal.y - 55 };
        this.player.setPosition(position.x, position.y);
        void authorizeStreetExit(callbacks.onEnterStreet, () => {
          if (!destroyed) { this.previousLocation = 'station'; this.enterLocation('street'); }
        }).finally(() => { authorizing = false; });
        return;
      }
      if (portal) {
        this.previousLocation = portal.id as MapLocation;
        this.enterLocation(this.previousLocation);
      }
    }
  }
  const game = new P.Game({ type: P.AUTO, parent, width: parent.clientWidth, height: parent.clientHeight, backgroundColor: '#e4cda9', scene: StationScene,
    scale: { mode: P.Scale.RESIZE, autoCenter: P.Scale.CENTER_BOTH }, render: { pixelArt: false }, loader: { timeout: 15000 } });
  return { destroy: () => { destroyed = true; packRequest?.abort(); game.destroy(true); }, pause: (value, pauseWorld = value, talkingNpc = null) => { paused = value; worldPaused = pauseWorld; conversationNpcId = talkingNpc; }, unlockExit: (value) => { exitUnlocked = value; }, talk,
    setAppearance: (value) => { if (callbacks.practice) return; appearance = value; refreshAppearance?.(); } };
}
