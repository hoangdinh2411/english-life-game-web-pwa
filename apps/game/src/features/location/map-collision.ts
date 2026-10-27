import type { Point } from '../../types/gameplay/world';

export interface CollisionPolygon {
  kind: 'polygon';
  points: readonly (readonly [number, number])[];
}

export interface CollisionCircle {
  kind: 'circle';
  x: number;
  y: number;
  radius: number;
}

export type CollisionShape = CollisionPolygon | CollisionCircle;

export interface MapCollisionData {
  version: number;
  width: number;
  height: number;
  walkable: readonly CollisionPolygon[];
  obstacles: readonly CollisionShape[];
}

interface CompiledShape {
  shape: CollisionShape;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface MapCollision {
  data: MapCollisionData;
  canWalk: (point: Point) => boolean;
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function parsePoint(value: unknown, label: string): readonly [number, number] {
  if (!Array.isArray(value) || value.length !== 2 || !finite(value[0]) || !finite(value[1])) {
    throw new Error(`${label} must be an [x,y] point`);
  }
  return [value[0], value[1]];
}

function parseShape(value: unknown, label: string, polygonOnly = false): CollisionShape {
  if (typeof value !== 'object' || value === null || !('kind' in value)) {
    throw new Error(`${label} is invalid`);
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.kind === 'polygon') {
    if (!Array.isArray(candidate.points) || candidate.points.length < 3) {
      throw new Error(`${label} needs at least three points`);
    }
    return {
      kind: 'polygon',
      points: candidate.points.map((point, index) => parsePoint(point, `${label}.points[${index}]`)),
    };
  }
  if (!polygonOnly && candidate.kind === 'circle' && finite(candidate.x)
    && finite(candidate.y) && finite(candidate.radius) && candidate.radius > 0) {
    return { kind: 'circle', x: candidate.x, y: candidate.y, radius: candidate.radius };
  }
  throw new Error(`${label} has an unsupported shape`);
}

function parseData(value: unknown, label: string): MapCollisionData {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`${label} collision map is invalid`);
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.version !== 1 || !finite(candidate.width) || candidate.width <= 0
    || !finite(candidate.height) || candidate.height <= 0
    || !Array.isArray(candidate.walkable) || candidate.walkable.length === 0
    || !Array.isArray(candidate.obstacles)) {
    throw new Error(`${label} collision map is incomplete`);
  }
  return {
    version: 1,
    width: candidate.width,
    height: candidate.height,
    walkable: candidate.walkable.map((shape, index) => parseShape(shape, `${label} walkable[${index}]`, true) as CollisionPolygon),
    obstacles: candidate.obstacles.map((shape, index) => parseShape(shape, `${label} obstacles[${index}]`)),
  };
}

function compile(shape: CollisionShape): CompiledShape {
  if (shape.kind === 'circle') {
    return {
      shape,
      left: shape.x - shape.radius,
      right: shape.x + shape.radius,
      top: shape.y - shape.radius,
      bottom: shape.y + shape.radius,
    };
  }
  const xs = shape.points.map(point => point[0]);
  const ys = shape.points.map(point => point[1]);
  return { shape, left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
}

function polygonContains(point: Point, polygon: CollisionPolygon): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.points.length - 1; index < polygon.points.length; previous = index++) {
    const current = polygon.points[index]!; const prior = polygon.points[previous]!;
    if (current[1] > point.y !== prior[1] > point.y
      && point.x < (prior[0] - current[0]) * (point.y - current[1]) / (prior[1] - current[1]) + current[0]) inside = !inside;
  }
  return inside;
}

function contains(point: Point, compiled: CompiledShape, circleClearance = 0): boolean {
  const clearance = compiled.shape.kind === 'circle' ? circleClearance : 0;
  if (point.x < compiled.left - clearance || point.x > compiled.right + clearance
    || point.y < compiled.top - clearance || point.y > compiled.bottom + clearance) {
    return false;
  }
  return compiled.shape.kind === 'circle'
    ? Math.hypot(point.x - compiled.shape.x, point.y - compiled.shape.y) <= compiled.shape.radius + circleClearance
    : polygonContains(point, compiled.shape);
}

export function createMapCollision(rawData: unknown, options: { label: string; circleClearance?: number }): MapCollision {
  const data = parseData(rawData, options.label);
  const walkable = data.walkable.map(compile);
  const obstacles = data.obstacles.map(compile);
  return {
    data,
    canWalk: point => walkable.some(shape => contains(point, shape))
      && !obstacles.some(shape => contains(point, shape, options.circleClearance ?? 0)),
  };
}
