import type { Point } from '../../types/gameplay/world';
import { createMapCollision } from './map-collision';
import rawCollisionMap from './town-street-collision.json';

export const TOWN_STREET_PLAYER_CLEARANCE = 5;
const collision = createMapCollision(rawCollisionMap, { label: 'Town Street', circleClearance: TOWN_STREET_PLAYER_CLEARANCE });
export const TOWN_STREET_COLLISION = collision.data;

export function canWalkTownStreet(point: Point): boolean {
  return collision.canWalk(point);
}
