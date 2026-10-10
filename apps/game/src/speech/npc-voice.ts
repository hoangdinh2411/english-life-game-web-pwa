import type { StationSpeaker } from '@life-abroad/shared';
import type { VoiceGender } from '../types/speech/narration';

export const npcVoice: Record<StationSpeaker, VoiceGender> = {
  npc_station_information: 'female',
  npc_passenger_backpack: 'female',
  npc_passenger_suitcase: 'male',
};
