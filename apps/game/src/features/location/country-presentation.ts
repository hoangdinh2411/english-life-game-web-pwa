import type { MapLocation } from '../../types/gameplay/world';

const PLACE_NAMES: Record<MapLocation, string> = {
  station: 'Train Station',
  cafe: 'Café',
  corner_cafe: 'Corner Cup Café',
  clothes: 'Clothes Shop',
  tax_office: 'Tax Office',
  street: 'Town Street',
};

const displayCountry = (countryName: string | undefined): string | null => countryName?.trim() || null;

export const countryLocationLabel = (countryName: string | undefined, location: MapLocation): string =>
  [displayCountry(countryName), PLACE_NAMES[location]].filter(Boolean).join(' · ');

export const countryWelcomeLabel = (countryName: string | undefined): string =>
  displayCountry(countryName) ? `Ruth · Welcome to ${displayCountry(countryName)}!` : 'Ruth · Welcome!';

export const countryResidentHint = (countryName: string | undefined): string =>
  `Try asking about the weather, hobbies, food or life ${displayCountry(countryName) ? `in ${displayCountry(countryName)}` : 'here'}.`;
