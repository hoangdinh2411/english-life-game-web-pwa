import player from '../../assets/runtime/player-portrait.png';
import backpack from '../../assets/runtime/backpack-portrait.png';
import suitcase from '../../assets/runtime/suitcase-portrait.png';
import receptionist from '../../assets/runtime/receptionist-portrait.png';
import type { StationSpeaker } from '@life-abroad/shared';
export const playerPortrait = player;
export const npcPortraits: Record<StationSpeaker, string> = { npc_passenger_backpack: backpack, npc_passenger_suitcase: suitcase, npc_station_information: receptionist };
