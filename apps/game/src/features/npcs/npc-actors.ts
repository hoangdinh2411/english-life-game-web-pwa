import type Phaser from 'phaser';
import type { Direction, Point, StationNpc } from '../../types/gameplay/world';
import { advanceNpc, NPC_STOP_DISTANCE, type NpcPatrol } from './npc-motion';

export interface NpcActor {
  npc: StationNpc;
  anchor: Point;
  sprite: Phaser.GameObjects.Sprite;
  shadow?: Phaser.GameObjects.Ellipse;
  label: Phaser.GameObjects.Text;
  elapsed: number;
  labelOffset: number;
  idleFrame: string;
  idleFrames?: Partial<Record<Direction, string>>;
  walkPrefix?: string;
  artTextureKey?: string;
  artFrame?: string;
  clip?: (anchor: Point, offset: Point) => Point;
  patrol?: NpcPatrol;
  baseScaleY?: number;
  idleElapsed?: number;
}

export function updateNpcActors(actors: NpcActor[], player: Point, delta: number, paused: boolean, conversationNpcId: string | null = null): void {
  let nearest: NpcActor | undefined;
  let nearestDistance = NPC_STOP_DISTANCE;
  if (conversationNpcId === null) {
    for (const actor of actors) {
      if (actor.sprite.visible === false) continue;
      const distance = Math.hypot(actor.npc.x - player.x, actor.npc.y - player.y);
      if (distance <= nearestDistance && (!nearest || distance < nearestDistance)) {
        nearest = actor;
        nearestDistance = distance;
      }
    }
  }
  const stoppedNpcId = conversationNpcId ?? nearest?.npc.id ?? null;
  for (const actor of actors) {
    if (actor.sprite.visible === false) continue;
    const state = { x: actor.npc.x, y: actor.npc.y, elapsed: actor.elapsed };
    const pose = advanceNpc(actor.npc.id, state, actor.anchor, player, delta, paused, stoppedNpcId, actor.clip, actor.patrol, false);
    actor.elapsed = state.elapsed;
    actor.npc.x = pose.x; actor.npc.y = pose.y;
    actor.sprite.setPosition(pose.x, pose.y).setDepth(pose.y);
    actor.shadow?.setPosition(pose.x, pose.y - 3);
    actor.label.setPosition(pose.x, pose.y - actor.labelOffset);
    if (!paused) actor.idleElapsed = ((actor.idleElapsed ?? 0) + delta) % 100000;
    if (actor.walkPrefix && pose.moving) {
      if (actor.baseScaleY !== undefined && typeof actor.sprite.setScale === 'function') {
        actor.sprite.setScale(actor.sprite.scaleX, actor.baseScaleY);
      }
      actor.sprite.play(`${actor.walkPrefix}-${{ down: 0, left: 1, right: 2, up: 3 }[pose.direction]}`, true);
    } else {
      actor.sprite.anims.stop();
      actor.sprite.setFrame(actor.idleFrames?.[pose.direction] ?? actor.idleFrame);
      if (typeof actor.sprite.setScale === 'function') {
        if (actor.baseScaleY === undefined) actor.baseScaleY = actor.sprite.scaleY ?? 1;
        const breath = 1 + 0.018 * Math.sin((actor.idleElapsed ?? 0) * 0.003);
        actor.sprite.setScale(actor.sprite.scaleX, actor.baseScaleY * breath);
      }
    }
  }
}
