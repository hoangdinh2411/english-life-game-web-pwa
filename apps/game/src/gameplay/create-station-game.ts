import type { MapLocation, NpcActor, Point, StationCallbacks, StationGame, StationPortal } from '../types/gameplay/world';
import Phaser from 'phaser';
import { destinationMaps, stationAtlases, stationBackground } from './station-assets';
import { canWalk, findPath, movePlayer, movementDelta, nearestNpc, portalAt, STATION_NPCS, STATION_PORTALS } from './station-navigation';
import { npcIdlePose } from './npc-idle';
import { npcNeedsTalk } from './arrival-hud';
const LOCATION_NAMES: Record<MapLocation, string> = { station: 'Maplewood · Train Station', cafe: 'Maplewood · Café', clothes: 'Maplewood · Clothes Shop', street: 'Maplewood · Town Street' };

export function createStationGame(parent: HTMLElement, callbacks: StationCallbacks): StationGame {
  let activeLocation: MapLocation = 'station';
  const P = Phaser;
  let paused = false;
  let exitUnlocked = false;
  let blockedPortal: string | null = null;
  let position: Point = { x: 768, y: 370 };
  let destinationMapTarget: Point | null = null;
  let destination: Point | null = null;
  let route: Point[] = [];
  let selectedNpc: string | null = null;
  let nearby: string | null = null;
  const npcs = STATION_NPCS.map((npc) => ({ ...npc }));
  const talk = () => { const npc = nearestNpc(position, npcs); if (!paused && npc) callbacks.onTalk(npc.id); };
  class StationScene extends P.Scene {
    private player!: Phaser.GameObjects.Sprite;
    private marker!: Phaser.GameObjects.Arc;
    private keys: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
    private walkingKeys: Record<string, Phaser.Input.Keyboard.Key> = {};
    private labels: Phaser.GameObjects.Text[] = [];
    private npcActors: NpcActor[] = [];
    private transitionPending = false;
    preload() {
      this.load.image(activeLocation, activeLocation === 'station' ? stationBackground : destinationMaps[activeLocation]);
      for (const atlas of stationAtlases) if (activeLocation === 'station' || atlas.key === 'player') this.load.atlas(atlas.key, atlas.url, atlas.data);
      const onLoadError = () => callbacks.onError('Station artwork could not load. Please retry.');
      this.load.on('loaderror', onLoadError);
      this.events.once('shutdown', () => this.load.off('loaderror', onLoadError));
    }
    create() {
      if (!this.textures.exists(activeLocation) || !this.textures.exists('player') || (activeLocation === 'station' && stationAtlases.some((atlas) => !this.textures.exists(atlas.key)))) return;
      this.transitionPending = false;
      this.labels = [];
      this.npcActors = [];
      this.add.image(0, 0, activeLocation).setOrigin(0);
      this.marker = this.add.circle(0, 0, 16, 0xf6df9e, 0.5).setStrokeStyle(3, 0x426f61).setVisible(false);
      // Animations belong to the game and survive location-scene restarts.
      for (let row = 0; row < 4; row++) if (!this.anims.exists(`walk-${row}`)) this.anims.create({ key: `walk-${row}`, frames: Array.from({ length: 4 }, (_, column) => ({ key: 'player', frame: `${row}-${column}` })), frameRate: 7, repeat: -1 });
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
        const name = npc.texture === 'backpack' ? 'Backpacker' : npc.texture === 'suitcase' ? 'Traveler' : 'Receptionist';
        const needsTalk = npcNeedsTalk(npc.id);
        const label = this.add.text(npc.x, npc.y - 108, needsTalk ? `! ${name}` : name, { fontFamily: 'sans-serif', fontSize: '24px', fontStyle: needsTalk ? 'bold' : 'normal', color: '#263630', backgroundColor: needsTalk ? '#ffe08a' : '#fff6df', padding: { x: 8, y: 5 } }).setOrigin(0.5, 1).setDepth(1500);
        this.labels.push(label);
        this.npcActors.push({ sprite, shadow, label, elapsed: 0 });
      }
      if (activeLocation === 'station') for (const portal of STATION_PORTALS) this.addPortalRing(portal);
      else this.addPortalRing({ id: 'station', label: 'Train Station', x: 768, y: activeLocation === 'street' ? 130 : 930 });
      this.player = this.add.sprite(position.x, position.y, 'player', '0-0').setOrigin(0.5, 1).setScale(2);
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
          if (target.x >= 48 && target.x <= 1488 && target.y >= 120 && target.y <= 980) { destinationMapTarget = target; this.marker.setPosition(target.x, target.y).setVisible(true); }
        } else if (canWalk(target)) { route = findPath(position, target); destination = route.shift() ?? null; selectedNpc = null; this.marker.setPosition(target.x, target.y).setVisible(true); }
      });
      const resizeLabels = () => {
        const zoom = Math.max(this.scale.width / 1536, this.scale.height / 1024);
        this.cameras.main.setZoom(zoom);
        for (const label of this.labels) label.setFontSize(Math.round(13 / zoom));
      };
      this.cameras.main.setBounds(0, 0, 1536, 1024).startFollow(this.player, false, 0.12, 0.12);
      resizeLabels();
      this.scale.on('resize', resizeLabels);
      this.events.once('shutdown', () => this.scale.off('resize', resizeLabels));
      callbacks.onLocationChange(LOCATION_NAMES[activeLocation]);
      callbacks.onReady();
    }
    private addPortalRing(portal: StationPortal) {
      const halo = this.add.circle(portal.x, portal.y, 34, 0x73dfa0, 0.3).setStrokeStyle(4, 0x9cffbd, 0.85).setDepth(5);
      this.add.circle(portal.x, portal.y, 22, 0xc3ffd5, 0.14).setStrokeStyle(2, 0xd3ffe0, 0.75).setDepth(5);
      this.add.text(portal.x, portal.y - 42, portal.label, { fontFamily: 'sans-serif', fontSize: '22px', color: '#263630', backgroundColor: '#fff6df', padding: { x: 8, y: 5 } }).setOrigin(0.5, 1).setDepth(1500);
      this.tweens.add({ targets: halo, scale: 1.2, alpha: 0.72, duration: 750, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    private enterLocation(location: MapLocation) {
      if (this.transitionPending) return;
      this.transitionPending = true;
      activeLocation = location;
      destinationMapTarget = null;
      route = [];
      selectedNpc = null;
      nearby = null;
      if (location === 'station') {
        const portal = STATION_PORTALS.find((item) => item.id === this.previousLocation);
        position = portal ? { x: portal.x + (portal.id === 'cafe' ? 70 : portal.id === 'clothes' ? -70 : 0), y: portal.id === 'street' ? 850 : 750 } : { x: 768, y: 370 };
      } else if (location === 'street') position = { x: 768, y: 210 };
      else position = { x: 768, y: 860 };
      callbacks.onLocationChange(LOCATION_NAMES[location]);
      this.scene.restart();
    }
    private previousLocation: MapLocation = 'station';
    private updateDestination(delta: number) {
      if (paused) { destinationMapTarget = null; this.marker.setVisible(false); this.player.anims.stop(); return; }
      const x = Number(this.keys?.right.isDown || this.walkingKeys.D?.isDown) - Number(this.keys?.left.isDown || this.walkingKeys.A?.isDown);
      const y = Number(this.keys?.down.isDown || this.walkingKeys.S?.isDown) - Number(this.keys?.up.isDown || this.walkingKeys.W?.isDown);
      let dx = x, dy = y;
      if (x || y) destinationMapTarget = null;
      else if (destinationMapTarget) { dx = destinationMapTarget.x - position.x; dy = destinationMapTarget.y - position.y; }
      const movement = movementDelta({ x: dx, y: dy }, 215 * Math.min(delta, 50) / 1000, Boolean(x || y));
      position = { x: Math.max(48, Math.min(1488, position.x + movement.x)), y: Math.max(110, Math.min(985, position.y + movement.y)) };
      this.player.setPosition(position.x, position.y).setDepth(position.y);
      if (movement.x || movement.y) this.player.play(`walk-${Math.abs(dx) > Math.abs(dy) ? dx < 0 ? 1 : 2 : dy < 0 ? 3 : 0}`, true);
      else this.player.anims.stop();
      const ring = { id: 'station', label: 'Train Station', x: 768, y: activeLocation === 'street' ? 130 : 930 };
      if (portalAt(position, [ring])) { this.previousLocation = activeLocation; this.enterLocation('station'); return; }
      destinationMapTarget = destinationMapTarget && Math.hypot(destinationMapTarget.x - position.x, destinationMapTarget.y - position.y) > 3 ? destinationMapTarget : null;
      if (!destinationMapTarget) this.marker.setVisible(false);
    }
    update(_time: number, delta: number) {
      if (!this.player) return;
      if (activeLocation !== 'station') { this.updateDestination(delta); return; }
      for (const [index, actor] of this.npcActors.entries()) {
        const npc = npcs[index];
        const anchor = STATION_NPCS[index];
        if (!npc || !anchor) continue;
        // Stop when approached, so tapping/talking never chases a moving target.
        if (paused || Math.hypot(position.x - npc.x, position.y - npc.y) <= 120) { actor.sprite.anims.stop(); actor.sprite.setFrame('0-0'); continue; }
        actor.elapsed += Math.min(delta, 50);
        const pose = npcIdlePose(anchor, actor.elapsed, index);
        npc.x = pose.x;
        npc.y = pose.y;
        actor.sprite.setPosition(npc.x, npc.y).setDepth(npc.y);
        actor.shadow.setPosition(npc.x, npc.y - 3);
        actor.label.setPosition(npc.x, npc.y - 108);
        const row = { down: 0, left: 1, right: 2, up: 3 }[pose.direction];
        actor.sprite.play(`${npc.texture}-walk-${row}`, true);
      }
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
        if (moved) this.player.play(`walk-${Math.abs(dx) > Math.abs(dy) ? dx < 0 ? 1 : 2 : dy < 0 ? 3 : 0}`, true);
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
      if (portal) { this.previousLocation = portal.id as MapLocation; this.enterLocation(this.previousLocation); }
    }
  }
  const game = new P.Game({ type: P.AUTO, parent, width: parent.clientWidth, height: parent.clientHeight, backgroundColor: '#e4cda9', scene: StationScene,
    scale: { mode: P.Scale.RESIZE, autoCenter: P.Scale.CENTER_BOTH }, render: { pixelArt: false }, audio: { noAudio: true } });
  return { destroy: () => game.destroy(true), pause: (value) => { paused = value; }, unlockExit: (value) => { exitUnlocked = value; }, talk };
}
