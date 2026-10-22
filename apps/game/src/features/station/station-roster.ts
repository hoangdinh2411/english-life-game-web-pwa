import type { StationSpeaker } from '@life-abroad/shared';
import type { VoiceGender } from '../../types/speech/narration';

export interface StationNpcDefinition {
  id: StationSpeaker;
  name: string;
  texture: 'backpack' | 'suitcase' | 'visitor' | 'receptionist';
  x: number;
  y: number;
  scale: number;
  voice: VoiceGender;
  portrait: 'backpack' | 'suitcase' | 'visitor' | 'receptionist';
  portraitGrid?: Readonly<{ columns: number; rows: number }>;
  portraitPosition?: string;
  patrol?: Readonly<{ points: readonly Readonly<{ x: number; y: number }>[]; startWaypoint: number }>;
}

export const STATION_ROSTER = [
  {
    id: 'npc_passenger_backpack', name: 'Sofia', texture: 'backpack', x: 592, y: 380,
    scale: 2, voice: 'female', portrait: 'backpack',
  },
  {
    id: 'npc_passenger_suitcase', name: 'Elias', texture: 'suitcase', x: 950, y: 380,
    scale: 2, voice: 'male', portrait: 'suitcase',
  },
  {
    id: 'npc_passenger_visitor', name: 'Ingrid', texture: 'visitor', x: 610, y: 700,
    scale: 0.6, voice: 'female', portrait: 'visitor',
    portraitGrid: { columns: 3, rows: 1 }, portraitPosition: '0% 0%',
  },
  {
    id: 'npc_station_information', name: 'Ruth', texture: 'receptionist', x: 850, y: 615,
    scale: 2, voice: 'female', portrait: 'receptionist',
    patrol: {
      points: [{ x: 850, y: 615 }, { x: 875, y: 630 }, { x: 850, y: 650 }, { x: 825, y: 630 }],
      startWaypoint: 0,
    },
  },
] as const satisfies readonly StationNpcDefinition[];

export const STATION_PASSENGERS = STATION_ROSTER.filter(npc => npc.id !== 'npc_station_information');

export function isStationSpeaker(id: string): id is StationSpeaker {
  return STATION_ROSTER.some(npc => npc.id === id);
}

export function stationNpc(id: StationSpeaker): StationNpcDefinition {
  const npc = STATION_ROSTER.find(candidate => candidate.id === id);
  if (!npc) throw new Error(`Unknown station NPC ${id}`);
  return npc;
}
