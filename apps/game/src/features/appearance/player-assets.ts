import type { PlayerGender } from '@life-abroad/shared';
import maleSheet from '../../../assets/runtime/player-male.png';
import malePortrait from '../../../assets/runtime/player-portrait.png';
import femaleSheet from '../../../assets/runtime/player-female-smooth.png';
import femalePortrait from '../../../assets/runtime/player-female-portrait.png';
import { PRACTICE_PLAYER_FRAME, SAVED_PLAYER_FRAME } from './player-frame';
import { NPC_DISPLAY_SCALE } from '../npcs/actor-display';

export interface PlayerAssets {
  sheet: string;
  portrait: string;
  frame: { width: number; height: number };
  displayScale: number;
  portraitColumns: number;
}

const assets: Record<PlayerGender, PlayerAssets> = {
  male: { sheet: maleSheet, portrait: malePortrait, frame: SAVED_PLAYER_FRAME, displayScale: NPC_DISPLAY_SCALE, portraitColumns: 1 },
  female: { sheet: femaleSheet, portrait: femalePortrait, frame: PRACTICE_PLAYER_FRAME, displayScale: 2, portraitColumns: 1 },
};

export function playerAssets(gender: PlayerGender): PlayerAssets {
  return assets[gender];
}

export function playerWalkFrame(row: number, column: number, usesMapPack: boolean): string | number {
  return usesMapPack ? row * 4 + column : `${row}-${column}`;
}
