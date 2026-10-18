import { schemaFromParser } from './auth';
import type { PlayerLocation } from './player-location';

export interface StarterCity {
  id: string;
  name: string;
  description?: string;
}

export interface AvatarOption {
  id: string;
  label: string;
  outfitColor: string;
}

export interface OnboardingOptions {
  cities: StarterCity[];
  avatars: AvatarOption[];
}

export interface CreateCharacterRequest {
  name: string;
  cityId: string;
  avatarId: string;
}

export interface Character {
  id: string;
  userId: string;
  name: string;
  cityId: string;
  avatarId: string;
  lastLocation: PlayerLocation;
}

export interface PlayerState {
  user: { id: string; email: string; displayName: string };
  character: Character;
  stats: { xp: number; coins: number };
  inventory: Array<{ itemId: string; quantity: number }>;
  questProgress: Array<{ questId: string; status: 'not_started' | 'active' | 'done' }>;
}

export interface PlayerResponse {
  user: { id: string; email: string; displayName: string };
  character: Character | null;
  stats: { xp: number; coins: number };
}

export function parseCreateCharacterRequest(value: unknown): CreateCharacterRequest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Invalid character request');
  const request = value as Record<string, unknown>;
  if (Object.keys(request).some((key) => !['name', 'cityId', 'avatarId'].includes(key))) throw new Error('Unexpected character request field');
  const { name, cityId, avatarId } = request;
  if (typeof name !== 'string' || name.trim().length === 0 || name.length > 2000) throw new Error('Name must contain a non-whitespace character and be under 2000 characters');
  if (typeof cityId !== 'string' || !/^city_[a-z0-9_]+$/.test(cityId)) throw new Error('Invalid city id');
  if (typeof avatarId !== 'string' || !/^avatar_[a-z0-9_]+$/.test(avatarId)) throw new Error('Invalid avatar id');
  return { name, cityId, avatarId };
}

export function parseOnboardingOptions(value: unknown): OnboardingOptions {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Invalid onboarding catalog');
  const options = value as Record<string, unknown>;
  if (!Array.isArray(options.cities) || !Array.isArray(options.avatars)) throw new Error('Invalid onboarding catalog');
  const cities: StarterCity[] = options.cities.map((item) => {
    if (typeof item !== 'object' || item === null || typeof item.id !== 'string' || typeof item.name !== 'string') throw new Error('Invalid city catalog entry');
    if (item.description !== undefined && typeof item.description !== 'string') throw new Error('Invalid city description');
    return item.description === undefined ? { id: item.id, name: item.name } : { id: item.id, name: item.name, description: item.description };
  });
  const avatars: AvatarOption[] = options.avatars.map((item) => {
    if (typeof item !== 'object' || item === null || typeof item.id !== 'string' || typeof item.label !== 'string' || typeof item.outfitColor !== 'string') throw new Error('Invalid avatar catalog entry');
    return { id: item.id, label: item.label, outfitColor: item.outfitColor };
  });
  if (new Set(cities.map(({ id }) => id)).size !== cities.length || new Set(avatars.map(({ id }) => id)).size !== avatars.length) throw new Error('Duplicate onboarding catalog id');
  return { cities, avatars };
}
export const createCharacterSchema = schemaFromParser(parseCreateCharacterRequest);
