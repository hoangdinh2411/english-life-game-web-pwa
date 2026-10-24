import type { PlayerGender } from '@life-abroad/shared';
import maleSheet from '../../../assets/runtime/player.png';
import malePortrait from '../../../assets/runtime/player-portrait.png';
import femaleSheet from '../../../assets/runtime/player-female-smooth.png';
import femalePortrait from '../../../assets/runtime/player-female-portrait.png';

export interface PlayerAssets {
  sheet: string;
  portrait: string;
  frame: { width: number; height: number };
  displayScale: number;
  portraitColumns: number;
}

const assets: Record<PlayerGender, PlayerAssets> = {
  male: { sheet: maleSheet, portrait: malePortrait, frame: { width: 32, height: 48 }, displayScale: 1.95, portraitColumns: 1 },
  female: { sheet: femaleSheet, portrait: femalePortrait, frame: { width: 32, height: 48 }, displayScale: 2, portraitColumns: 1 },
};

export function playerAssets(gender: PlayerGender): PlayerAssets {
  return assets[gender];
}

export function playerWalkFrame(row: number, column: number, usesMapPack: boolean): string | number {
  return usesMapPack ? row * 4 + column : `${row}-${column}`;
}
