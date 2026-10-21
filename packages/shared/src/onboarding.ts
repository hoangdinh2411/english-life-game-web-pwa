import { schemaFromParser } from './auth';
import type { PlayerLocation } from './player-location';

export interface CountryOption {
  id: string;
  name: string;
  isoCode: string;
  flag: string;
  timeZone: string;
}

export interface CountryCatalogEntry extends CountryOption {
  starterCityId: string;
}

export interface AvatarOption {
  id: string;
  label: string;
  outfitColor: string;
}

export interface OnboardingOptions {
  countries: CountryOption[];
  avatars: AvatarOption[];
}

export interface CreateCharacterRequest {
  name: string;
  countryId: string;
  avatarId: string;
}

export interface Character {
  id: string;
  userId: string;
  name: string;
  cityId: string;
  countryId: string;
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
  if (Object.keys(request).some((key) => !['name', 'countryId', 'avatarId'].includes(key))) throw new Error('Unexpected character request field');
  const { name, countryId, avatarId } = request;
  if (typeof name !== 'string' || name.trim().length === 0 || name.length > 2000) throw new Error('Name must contain a non-whitespace character and be under 2000 characters');
  if (typeof countryId !== 'string' || !/^country_[a-z0-9_]+$/.test(countryId)) throw new Error('Invalid country id');
  if (typeof avatarId !== 'string' || !/^avatar_[a-z0-9_]+$/.test(avatarId)) throw new Error('Invalid avatar id');
  return { name, countryId, avatarId };
}

function parseCountry(value: unknown, includeStarterCity: boolean): CountryOption | CountryCatalogEntry {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Invalid country catalog entry');
  const item = value as Record<string, unknown>;
  const allowed = includeStarterCity ? ['id', 'name', 'isoCode', 'flag', 'timeZone', 'starterCityId'] : ['id', 'name', 'isoCode', 'flag', 'timeZone'];
  if (Object.keys(item).some(key => !allowed.includes(key))) throw new Error('Unexpected country catalog field');
  if (typeof item.id !== 'string' || !/^country_[a-z0-9_]+$/.test(item.id)) throw new Error('Invalid country id');
  if (typeof item.name !== 'string' || item.name.trim().length === 0) throw new Error('Invalid country name');
  if (typeof item.isoCode !== 'string' || !/^[A-Z]{2}$/.test(item.isoCode)) throw new Error('Invalid country ISO code');
  if (typeof item.flag !== 'string' || item.flag.length === 0) throw new Error('Invalid country flag');
  if (typeof item.timeZone !== 'string') throw new Error('Invalid country time zone');
  try { new Intl.DateTimeFormat('en', { timeZone: item.timeZone }).format(); } catch { throw new Error('Invalid country time zone'); }
  const country: CountryOption = { id: item.id, name: item.name, isoCode: item.isoCode, flag: item.flag, timeZone: item.timeZone };
  if (!includeStarterCity) return country;
  if (typeof item.starterCityId !== 'string' || !/^city_[a-z0-9_]+$/.test(item.starterCityId)) throw new Error('Invalid starter city id');
  return { ...country, starterCityId: item.starterCityId };
}

export function parseCountryCatalog(value: unknown): CountryCatalogEntry[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error('Invalid country catalog');
  const countries = value.map(item => parseCountry(item, true) as CountryCatalogEntry);
  if (new Set(countries.map(({ id }) => id)).size !== countries.length || new Set(countries.map(({ isoCode }) => isoCode)).size !== countries.length) throw new Error('Duplicate country catalog id or ISO code');
  return countries;
}

export function parseOnboardingOptions(value: unknown): OnboardingOptions {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Invalid onboarding catalog');
  const options = value as Record<string, unknown>;
  if (!Array.isArray(options.countries) || !Array.isArray(options.avatars)) throw new Error('Invalid onboarding catalog');
  const countries = options.countries.map(item => parseCountry(item, false) as CountryOption);
  const avatars: AvatarOption[] = options.avatars.map((item) => {
    if (typeof item !== 'object' || item === null || typeof item.id !== 'string' || typeof item.label !== 'string' || typeof item.outfitColor !== 'string') throw new Error('Invalid avatar catalog entry');
    return { id: item.id, label: item.label, outfitColor: item.outfitColor };
  });
  if (new Set(countries.map(({ id }) => id)).size !== countries.length || new Set(avatars.map(({ id }) => id)).size !== avatars.length) throw new Error('Duplicate onboarding catalog id');
  return { countries, avatars };
}
export const createCharacterSchema = schemaFromParser(parseCreateCharacterRequest);
