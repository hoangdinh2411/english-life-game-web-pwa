import Phaser from 'phaser';
import type { CollisionShape, MapCollisionData } from './map-collision';

interface CollisionDebugOptions {
  scale: number;
  walkableColor: string;
  obstacleColor: string;
  depth?: number;
}

function drawShapes(
  graphics: Phaser.GameObjects.Graphics,
  shapes: readonly CollisionShape[],
  scale: number,
  color: string,
): void {
  graphics.lineStyle(2, Phaser.Display.Color.HexStringToColor(color).color, 0.9);
  for (const shape of shapes) {
    if (shape.kind === 'circle') {
      graphics.strokeCircle(shape.x * scale, shape.y * scale, shape.radius * scale);
      continue;
    }
    graphics.strokePoints(shape.points.map(point => new Phaser.Math.Vector2(
      point[0] * scale,
      point[1] * scale,
    )), true);
  }
}

export function drawCollisionDebug(
  scene: Phaser.Scene,
  collision: MapCollisionData,
  options: CollisionDebugOptions,
): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics().setDepth(options.depth ?? 1400);
  drawShapes(graphics, collision.walkable, options.scale, options.walkableColor);
  drawShapes(graphics, collision.obstacles, options.scale, options.obstacleColor);
  return graphics;
}
