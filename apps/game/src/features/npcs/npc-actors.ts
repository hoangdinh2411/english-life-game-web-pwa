import type Phaser from 'phaser';
import type { Direction, Point, StationNpc } from '../../types/gameplay/world';
import { advanceNpc, NPC_STOP_DISTANCE, type NpcPatrol } from './npc-motion';
import { UI_COLORS } from '../../styles/colors';

export interface NpcActor {
  npc: StationNpc;
  anchor: Point;
  sprite: Phaser.GameObjects.Sprite;
  shadow?: Phaser.GameObjects.Ellipse;
  label: Phaser.GameObjects.Text;
  sublabel?: Phaser.GameObjects.Text;
  indicatorDots?: Phaser.GameObjects.Text[];
  nameLabel?: string;
  elapsed: number;
  indicatorElapsed?: number;
  conversationReady?: boolean;
  idleFrame: string;
  idleFrames?: Partial<Record<Direction, string>>;
  walkPrefix?: string;
  artTextureKey?: string;
  artFrame?: string;
  clip?: (anchor: Point, offset: Point) => Point;
  patrol?: NpcPatrol;
}

export function npcNameplateOffset(displayHeight: number): number {
  return Math.min(100, Math.max(62, displayHeight * 0.84));
}

export function npcNameplateScreenSizes(width: number): { name: number; dots: number } {
  if (width <= 480) return { name: 13, dots: 16 };
  if (width <= 900) return { name: 15, dots: 18 };
  return { name: 17, dots: 20 };
}

export function npcSublabelScreenSize(width: number): number {
  return width <= 480 ? 9 : width <= 900 ? 10 : 11;
}

type ScalableText = Pick<Phaser.GameObjects.Text, 'setScale'>;

export function scaleNpcNameplates(
  labels: readonly ScalableText[],
  dots: readonly ScalableText[],
  width: number,
  zoom: number,
  sublabels: readonly ScalableText[] = [],
): void {
  const sizes = npcNameplateScreenSizes(width);
  const safeZoom = Math.max(zoom, Number.EPSILON);
  const labelScale = sizes.name / safeZoom / 24;
  const dotScale = sizes.dots / safeZoom / 28;
  const sublabelScale = npcSublabelScreenSize(width) / safeZoom / 16;
  labels.forEach(label => label.setScale(labelScale));
  dots.forEach(dot => dot.setScale(dotScale));
  sublabels.forEach(sublabel => sublabel.setScale(sublabelScale));
}

export function setNpcActorVisibility(actor: NpcActor, visible: boolean): void {
  actor.sprite.setVisible(visible);
  actor.shadow?.setVisible(visible);
  actor.label.setVisible(visible && !actor.conversationReady);
  actor.sublabel?.setVisible(visible && !actor.conversationReady);
  actor.indicatorDots?.forEach(dot => dot.setVisible(visible && Boolean(actor.conversationReady)));
}

export function updateNpcActors(actors: NpcActor[], player: Point, delta: number, paused: boolean, conversationNpcId: string | null = null): void {
  let nearest: NpcActor | undefined;
  let indicatorActor: NpcActor | undefined;
  let nearestDistance = NPC_STOP_DISTANCE;
  if (conversationNpcId === null) {
    for (const actor of actors) {
      if (actor.sprite.visible === false) {
        actor.indicatorDots?.forEach(dot => dot.setVisible(false));
        continue;
      }
      const distance = Math.hypot(actor.npc.x - player.x, actor.npc.y - player.y);
      if (distance <= nearestDistance && (!nearest || distance < nearestDistance)) {
        nearest = actor;
        nearestDistance = distance;
      }
    }
    indicatorActor = nearest;
  } else {
    indicatorActor = actors.find(actor => actor.npc.id === conversationNpcId);
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
    const conversationReady = actor === indicatorActor;
    const indicatorElapsed = conversationReady ? (actor.indicatorElapsed ?? 0) + delta : 0;
    actor.indicatorElapsed = indicatorElapsed;
    const desiredText = actor.nameLabel ?? actor.npc.name;
    if (actor.conversationReady !== conversationReady || actor.label.text !== desiredText) {
      actor.label
        .setText(desiredText)
        .setColor(UI_COLORS.creamTextPure)
        .setAlpha(1);
      actor.conversationReady = conversationReady;
    }
    actor.label
      .setPosition(pose.x, pose.y - npcNameplateOffset(actor.sprite.displayHeight))
      .setVisible(!conversationReady);
    const indicatorY = pose.y - npcNameplateOffset(actor.sprite.displayHeight);
    actor.sublabel
      ?.setPosition(pose.x, indicatorY - 28)
      .setVisible(!conversationReady);
    actor.indicatorDots?.forEach((dot, index) => {
      const bob = Math.sin(indicatorElapsed / 180 - index * 0.9) * 3;
      dot
        .setPosition(pose.x + (index - 1) * 11, indicatorY + bob)
        .setVisible(conversationReady);
    });
    if (actor.walkPrefix && pose.moving) {
      actor.sprite.play(`${actor.walkPrefix}-${{ down: 0, left: 1, right: 2, up: 3 }[pose.direction]}`, true);
    } else {
      actor.sprite.anims.stop();
      actor.sprite.setFrame(actor.idleFrames?.[pose.direction] ?? actor.idleFrame);
    }
  }
}
