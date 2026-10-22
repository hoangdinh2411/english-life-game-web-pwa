import type { StationSpeaker, Conversation } from '@life-abroad/shared';
import type { VoiceGender } from '../types/speech/narration';
import { STREET_NPCS, type StreetNpcId } from '../features/npcs/street-npcs';
import { STATION_ROSTER } from '../features/station/station-roster';

const streetNpcVoices = Object.fromEntries(STREET_NPCS.map(npc => [npc.id, npc.voice])) as Record<StreetNpcId, VoiceGender>;

export const npcVoice: Record<StationSpeaker | Conversation['npcId'], VoiceGender> = {
  ...Object.fromEntries(STATION_ROSTER.map(npc => [npc.id, npc.voice])) as Record<StationSpeaker, VoiceGender>,
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
  ...streetNpcVoices,
};
