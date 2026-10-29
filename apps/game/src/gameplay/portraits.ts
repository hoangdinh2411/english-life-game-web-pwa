import player from '../../assets/runtime/player-portrait.png';
import receptionist from '../../assets/runtime/receptionist-portrait.png';
import type { PlayerGender, StationSpeaker } from '@life-abroad/shared';
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
export const npcPortraits: Record<StationSpeaker, string> = {
  npc_passenger_backpack: '',
  npc_passenger_suitcase: '',
  npc_passenger_visitor: '',
  npc_station_information: receptionist,
};

export function registerStationNpcPortrait(npcId: StationSpeaker, url: string): void {
  npcPortraits[npcId] = url;
}
