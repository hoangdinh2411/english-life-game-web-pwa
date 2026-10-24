import player from '../../assets/runtime/player-portrait.png';
import backpack from '../../assets/runtime/backpack-portrait.png';
import suitcase from '../../assets/runtime/suitcase-portrait.png';
import receptionist from '../../assets/runtime/receptionist-portrait.png';
import visitor from '../../assets/npcs/npc_cafe_customer/portraits.png';
import type { PlayerGender, StationSpeaker } from '@life-abroad/shared';
import { STATION_ROSTER } from '../features/station/station-roster';
import { playerAssets } from '../features/appearance/player-assets';
export const playerPortrait = player;
export function playerPortraitPresentation(gender: PlayerGender = 'male') {
  const assets = playerAssets(gender);
  return {
    portrait: assets.portrait,
    portraitPosition: assets.portraitColumns > 1 ? '0% 0%' : undefined,
    portraitGrid: assets.portraitColumns > 1 ? { columns: assets.portraitColumns, rows: 1 } : undefined,
  };
}
const portraitAssets = { backpack, suitcase, receptionist, visitor };
export const npcPortraits = Object.fromEntries(STATION_ROSTER.map(npc => [npc.id, portraitAssets[npc.portrait]])) as Record<StationSpeaker, string>;
