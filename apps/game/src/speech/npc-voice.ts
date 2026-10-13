import type { StationSpeaker, Conversation } from '@life-abroad/shared';
import type { VoiceGender } from '../types/speech/narration';

export const npcVoice: Record<StationSpeaker | Conversation['npcId'], VoiceGender> = {
  npc_station_information: 'female',
  npc_passenger_backpack: 'female',
  npc_passenger_suitcase: 'male',
  npc_receptionist: 'female',
  npc_mia: 'female',
  npc_corner_cup_seller: 'female',
  npc_cafe_waiter: 'male',
  npc_cafe_customer: 'female',
  npc_corner_cup_assistant: 'male',
  npc_corner_cup_customer_1: 'female',
  npc_corner_cup_customer_2: 'female',
  npc_corner_cup_customer_3: 'female',
  npc_clothes_seller: 'male',
  npc_clothes_assistant: 'male',
  npc_clothes_customer: 'female',
};
